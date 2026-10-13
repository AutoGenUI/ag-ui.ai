import { z } from "zod";
import type { Database, NewsItem } from "./types";
import { categories } from "./types";
import { equalSecret, hmac, singaporeDay } from "./core";
import { renderMail } from "./mail-template";
import { articles, rateLimit } from "./store";
export type MailConfig = {
  enabled: boolean;
  apiKey: string;
  sender: string;
  secret: string;
  webhookSecret: string;
  domainVerified?: boolean;
  testRecipient?: string;
};
export const DAILY_EMAIL_LIMIT = 300;
export const WEEKLY_EMAIL_LIMIT = 250;
// This site's confirmed-subscriber policy, not a Brevo contact-list limit.
export const PUBLIC_SUBSCRIBER_CAPACITY = WEEKLY_EMAIL_LIMIT;
export const preferenceSchema = z.object({
  locale: z.enum(["en", "zh"]),
  topics: z.array(z.enum(categories)).min(1).max(6),
});
const subscriptionSchema = preferenceSchema.extend({
  email: z.string().email().max(254),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});
type Subscriber = {
  id: string;
  email: string;
  locale: "en" | "zh";
  topics: string;
  status: string;
  created_at: string;
  token_expires: string | null;
  is_test?: number;
};
// Two runId bindings: the first preserves legacy runs with no restart marker;
// the second must match the latest recorded generation when one exists.
const activeTestRunSql = "COALESCE((SELECT e.id FROM editions e WHERE e.is_test=1 AND substr(e.id,1,length('test-restart:'||s.id||':'))=('test-restart:'||s.id||':') ORDER BY e.created_at DESC,e.id DESC LIMIT 1),'test-restart:'||s.id||':'||?)=('test-restart:'||s.id||':'||?)";
export function mailReady(c: MailConfig) {
  return (
    c.enabled && !!c.apiKey && !!c.sender && !!c.secret && !!c.webhookSecret
  );
}
export async function mailCapacity(db: Database, c: MailConfig) {
  const confirmedCount = Number((await db.prepare(
    "SELECT count(*) AS count FROM subscribers WHERE is_test=0 AND status='confirmed'",
  ).first<{ count: number }>())?.count || 0);
  return {
    enabled: mailReady(c), confirmedCount, capacity: PUBLIC_SUBSCRIBER_CAPACITY,
    remaining: Math.max(0, PUBLIC_SUBSCRIBER_CAPACITY - confirmedCount),
    full: confirmedCount >= PUBLIC_SUBSCRIBER_CAPACITY,
    dailyLimit: DAILY_EMAIL_LIMIT, weeklyLimit: WEEKLY_EMAIL_LIMIT,
  };
}
const capacityFull = async (db: Database, c: MailConfig) => ({
  status: "capacity-full" as const, aggregateCapacity: await mailCapacity(db, c),
});
export function mailTestReady(c: MailConfig) {
  return (
    c.domainVerified === true &&
    !!c.apiKey && !!c.sender && !!c.secret && !!c.webhookSecret &&
    z.string().email().safeParse(c.testRecipient?.trim()).success
  );
}
export async function tokenFor(s: Subscriber, secret: string, kind = "manage") {
  return hmac(
    `${kind}:${s.id}:${kind === "confirm" ? s.token_expires : s.created_at}`,
    secret,
  );
}
export async function subscribe(
  db: Database,
  body: unknown,
  c: MailConfig,
  clientKey: string,
) {
  if (!mailReady(c)) return { status: "pending-activation" };
  const input = subscriptionSchema.parse(body),
    email = input.email.trim().toLowerCase();
  if ((await mailCapacity(db, c)).full) return capacityFull(db, c);
  if (
    !(await rateLimit(db, `signup:${clientKey}`, 5)) ||
    !(await rateLimit(db, `email:${await hmac(email, c.secret)}`, 2, 86400000))
  )
    return { status: "check-inbox" };
  const now = new Date().toISOString(),
    expires = new Date(Date.parse(now) + 86400000).toISOString(),
    candidate = `confirm:${crypto.randomUUID()}`;
  const previous = await db.prepare("SELECT * FROM subscribers WHERE email=?")
    .bind(email).first<Subscriber>();
  if (previous?.is_test === 0 && previous.status === "unsubscribed") {
    // A fresh, explicit public opt-in starts a new signed-link generation.
    // Its epoch is strictly newer than old delivery timestamps too: an old
    // callback can arrive in the same millisecond, or after clock correction.
    const history = await db.prepare("SELECT max(created_at) AS latest FROM deliveries WHERE subscriber_id=? AND is_test=0")
      .bind(previous.id).first<{ latest: string | null }>();
    const latestDelivery = Date.parse(history?.latest || "");
    const epoch = new Date(Math.max(Date.parse(now) + 1, Date.parse(previous.created_at) + 1,
      Number.isFinite(latestDelivery) ? latestDelivery + 1 : 0)).toISOString();
    const oldExpiry = Date.parse(previous.token_expires || "");
    const nextExpiry = new Date(Math.max(Date.parse(expires), Date.parse(epoch) + 86400000,
      Number.isFinite(oldExpiry) ? oldExpiry + 1 : 0)).toISOString();
    await db.batch([
      // This unique delivery is also the transaction's winner marker. A
      // delayed request cannot reopen an opt-out from a later generation.
      db.prepare("INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at) SELECT ?,s.id,'confirmation','queued',?,? FROM subscribers s WHERE s.id=? AND s.email=? AND s.created_at=? AND s.is_test=0 AND s.status='unsubscribed' AND (SELECT count(*) FROM subscribers WHERE is_test=0 AND status='confirmed')<? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=0 AND (d.status IN ('sending','uncertain') OR d.error IN ('hardbounce','spam','invalid')))")
        .bind(candidate, epoch, now, previous.id, email, previous.created_at, PUBLIC_SUBSCRIBER_CAPACITY),
      db.prepare("UPDATE subscribers SET status='pending',created_at=?,confirmed_at=NULL,token_expires=?,locale=?,topics=? WHERE id=? AND email=? AND created_at=? AND is_test=0 AND status='unsubscribed' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.id=? AND d.subscriber_id=subscribers.id AND d.is_test=0 AND d.status='queued' AND d.created_at=?)")
        .bind(epoch, nextExpiry, input.locale, JSON.stringify(input.topics), previous.id, email, previous.created_at, candidate, epoch),
      db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND is_test=0 AND status='queued' AND id<>? AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=? AND s.is_test=0 AND s.status='pending' AND s.created_at=?) AND EXISTS (SELECT 1 FROM deliveries winner WHERE winner.id=? AND winner.subscriber_id=? AND winner.is_test=0 AND winner.status='queued' AND winner.created_at=?)")
        .bind(now, previous.id, candidate, previous.id, epoch, candidate, previous.id, epoch),
    ]);
  } else await db.batch([
    // D1 serializes this batch. Concurrent callers use the actual email winner,
    // never a losing request's subscriber ID or confirmation expiry.
    db.prepare("INSERT OR IGNORE INTO subscribers(id,email,locale,topics,status,created_at,token_expires) SELECT ?,?,?,?,'pending',?,? WHERE (SELECT count(*) FROM subscribers WHERE is_test=0 AND status='confirmed')<?")
      .bind(crypto.randomUUID(), email, input.locale, JSON.stringify(input.topics), now, expires, PUBLIC_SUBSCRIBER_CAPACITY),
    // Any confirmation history protects a live token. An expired, known
    // generation can be replaced; sending/uncertain always requires review.
    db.prepare("INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at) SELECT ?,s.id,'confirmation','queued',?,? FROM subscribers s WHERE s.email=? AND s.is_test=0 AND s.status='pending' AND (SELECT count(*) FROM subscribers WHERE is_test=0 AND status='confirmed')<? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=0 AND d.kind='confirmation' AND (d.status IN ('sending','uncertain') OR s.token_expires>?))")
      .bind(candidate, now, now, email, PUBLIC_SUBSCRIBER_CAPACITY, now),
    // A live generation keeps its preferences as well as its HMAC, including
    // legacy rows without delivery history. Only an expired winner replaces
    // them; a fresh subscriber already carries the insert winner's choices.
    db.prepare("UPDATE subscribers SET locale=CASE WHEN token_expires>? THEN locale ELSE ? END,topics=CASE WHEN token_expires>? THEN topics ELSE ? END,token_expires=CASE WHEN token_expires>? THEN token_expires ELSE ? END WHERE email=? AND is_test=0 AND status='pending' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.id=? AND d.subscriber_id=subscribers.id AND d.is_test=0 AND d.status='queued')")
      .bind(now, input.locale, now, JSON.stringify(input.topics), now, expires, email, candidate),
    // Cancel old queued generations before another worker can claim a stale
    // expiry snapshot. A worker that already claimed sending blocks rotation.
    db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE is_test=0 AND kind='confirmation' AND status='queued' AND id<>? AND subscriber_id IN (SELECT s.id FROM subscribers s WHERE s.email=? AND s.is_test=0 AND s.status='pending' AND EXISTS (SELECT 1 FROM deliveries winner WHERE winner.id=? AND winner.subscriber_id=s.id AND winner.is_test=0 AND winner.status='queued'))")
      .bind(now, candidate, email, candidate),
  ]);
  const subscriber = await db.prepare("SELECT status,is_test FROM subscribers WHERE email=?")
    .bind(email).first<{ status: string; is_test: number }>();
  if ((await mailCapacity(db, c)).full) return capacityFull(db, c);
  if (!subscriber || subscriber.is_test !== 0 || subscriber.status !== "pending")
    return { status: "check-inbox" };
  await drainQueue(db, c, 5);
  return { status: "check-inbox" };
}
export async function manageSubscription(
  db: Database,
  input: Record<string, unknown>,
  c: MailConfig,
) {
  const id = z.string().uuid().parse(input.id),
    token = z.string().length(64).parse(input.token),
    action = z
      .enum(["confirm", "preferences", "unsubscribe", "read"])
      .parse(input.action);
  const s = await db
    .prepare("SELECT * FROM subscribers WHERE id=?")
    .bind(id)
    .first<Subscriber>();
  if (
    !s ||
    !c.secret ||
    !equalSecret(
      token,
      await tokenFor(s, c.secret, action === "confirm" ? "confirm" : "manage"),
    )
  )
    throw new Error("Invalid or expired link");
  let preferenceApplied = true;
  if (action === "confirm") {
    if (!s.token_expires || Date.parse(s.token_expires) <= Date.now())
      throw new Error("Confirmation link expired");
    await db
      .prepare(
        "UPDATE subscribers SET status='confirmed',confirmed_at=COALESCE(confirmed_at,?) WHERE id=? AND status='pending' AND created_at=? AND token_expires=? AND (is_test=1 OR (SELECT count(*) FROM subscribers WHERE is_test=0 AND status='confirmed')<?)",
      )
      .bind(new Date().toISOString(), id, s.created_at, s.token_expires, PUBLIC_SUBSCRIBER_CAPACITY)
      .run();
  } else if (action === "unsubscribe") {
    await db.batch([
      db
        .prepare("UPDATE subscribers SET status='unsubscribed' WHERE id=? AND created_at=? AND status<>'suppressed'")
        .bind(id, s.created_at),
      db
        .prepare(
          "UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND status='queued' AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=? AND s.created_at=? AND s.status IN ('unsubscribed','suppressed'))",
        )
        .bind(new Date().toISOString(), id, id, s.created_at),
    ]);
  } else if (action === "preferences") {
    const p = preferenceSchema.parse(input);
    const changed = await db
      .prepare(
        "UPDATE subscribers SET locale=?,topics=? WHERE id=? AND status='confirmed' AND created_at=?",
      )
      .bind(p.locale, JSON.stringify(p.topics), id, s.created_at)
      .run();
    preferenceApplied = changed.meta.changes > 0;
  }
  const current = await db
    .prepare(`SELECT locale,topics,status,is_test FROM subscribers WHERE id=? AND created_at=?${action === "confirm" ? " AND token_expires=?" : ""}`)
    .bind(id, s.created_at, ...(action === "confirm" ? [s.token_expires] : []))
    .first<{ locale: string; topics: string; status: string; is_test: number }>();
  if (!current) throw new Error("Invalid or expired link");
  const { is_test, ...subscriber } = current;
  const subscriptionType = is_test === 1 ? "test" : "public";
  if (action === "confirm" && current.status === "pending" && s.is_test !== 1)
    return { ...(await capacityFull(db, c)), subscriptionType };
  if (action === "confirm" && current.status !== "confirmed")
    return { status: "confirmation-unavailable", subscriberStatus: current.status, subscriptionType };
  if (action === "preferences" && !preferenceApplied)
    return { status: "preferences-not-saved", subscriberStatus: current.status, subscriptionType };
  return { ...subscriber, subscriptionType, token: await tokenFor(s, c.secret) };
}
export async function queueDigest(db: Database, week: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(week) ||
    new Date(week + "T00:00:00Z").getUTCDay() !== 1 ||
    week > singaporeDay()
  )
    throw new Error("Use a completed/current Monday date");
  let ed = await db
    .prepare("SELECT payload FROM editions WHERE id=?")
    .bind(week)
    .first<{ payload: string }>();
  if (!ed) {
    const prev = await db
      .prepare("SELECT payload FROM editions WHERE is_test=0 ORDER BY id DESC LIMIT 1")
      .first<{ payload: string }>();
    const from = prev
      ? JSON.parse(prev.payload).through
      : new Date(Date.parse(week) - 7 * 86400000).toISOString();
    const items = (await articles(db)).filter(
      (x) => x.indexedAt > from && x.indexedAt <= new Date().toISOString(),
    );
    if (!items.length) return { queued: 0, empty: true };
    const payload = JSON.stringify({
      items,
      through: new Date().toISOString(),
    });
    await db
      .prepare(
        "INSERT OR IGNORE INTO editions(id,payload,created_at) VALUES(?,?,?)",
      )
      .bind(week, payload, new Date().toISOString())
      .run();
    ed = { payload };
  }
  const items: NewsItem[] = JSON.parse(ed.payload).items;
  const subscribers = (
    await db
      .prepare("SELECT * FROM subscribers WHERE status='confirmed' AND is_test=0")
      .all<Subscriber>()
  ).results;
  let queued = 0;
  for (const s of subscribers) {
    const topics: string[] = JSON.parse(s.topics);
    if (!items.some((x) => topics.includes(x.category))) continue;
    const now = new Date(Math.max(Date.now(), Date.parse(s.created_at))).toISOString();
    const r = await db
      .prepare(
        "INSERT OR IGNORE INTO deliveries(id,subscriber_id,edition_id,kind,status,created_at,updated_at) SELECT ?,s.id,?,'weekly','queued',?,? FROM subscribers s WHERE s.id=? AND s.created_at=? AND s.is_test=0 AND s.status='confirmed'",
      )
      .bind(`${week}:${s.id}`, week, now, now, s.id, s.created_at)
      .run();
    queued += r.meta.changes;
  }
  return { queued, edition: week };
}
// This entry point is exposed only by the existing owner-authenticated MCP and
// admin operation dispatcher. Send actions cannot take an email address or
// change gates. Release only verifies the configured recipient, never sends.
export async function mailTest(
  db: Database,
  input: unknown,
  c: MailConfig,
) {
  const a = z.union([
    z.object({
      action: z.enum(["status", "restart", "confirmation", "weekly"]),
      runId: z.string().regex(/^[a-z0-9-]{8,80}$/).optional(),
      locale: z.enum(["en", "zh"]).default("zh"),
      topics: z.array(z.enum(categories)).min(1).max(6).default([...categories]),
    }).strict(),
    z.object({ action: z.literal("release"), expectedRecipient: z.string().email().max(254) }).strict(),
  ]).parse(input);
  const ready = mailTestReady(c);
  const recipient = c.testRecipient?.trim().toLowerCase() || "";
  if (a.action === "release" && (!z.string().email().safeParse(recipient).success ||
    a.expectedRecipient.trim().toLowerCase() !== recipient))
    throw new Error("Release requires expectedRecipient to match the server-configured test recipient");
  let s = await db.prepare("SELECT * FROM subscribers WHERE email=?")
    .bind(recipient).first<Subscriber>();
  type Restart = { id: string; payload: string; created_at: string };
  const readRestart = async () => s?.is_test === 1 ? db.prepare(
    "SELECT id,payload,created_at FROM editions WHERE is_test=1 AND substr(id,1,length(?))=? ORDER BY created_at DESC,id DESC LIMIT 1",
  ).bind(`test-restart:${s.id}:`, `test-restart:${s.id}:`).first<Restart>() : null;
  let restart = await readRestart();
  const restartData = () => restart ? JSON.parse(restart.payload) as {
    runId: string; previousTokenExpires: string | null;
  } : null;
  const status = async () => ({
    ready,
    publicEnabled: mailReady(c),
    recipientRole: s ? s.is_test === 1 ? "test" : "public" : null,
    subscriberStatus: s?.is_test === 1 ? s.status : null,
    activeTestRunId: restartData()?.runId || null,
    preferences: s?.is_test === 1 ? { locale: s.locale, topics: JSON.parse(s.topics) } : null,
    deliveries: s?.is_test === 1 ? (await db.prepare(
      "SELECT kind,status,attempted_at,updated_at,error FROM deliveries WHERE subscriber_id=? AND is_test=1 ORDER BY created_at DESC LIMIT 20",
    ).bind(s.id).all()).results : [],
  });
  if (a.action === "status") return status();
  if (a.action === "release") {
    // Releasing a test role is explicitly owner-authorized, not public consent.
    // It needs neither transport credentials nor a disabled public mail gate.
    if (!s) return { status: "test-recipient-not-found", ...(await status()) };
    if (s.is_test === 0) return { status: "already-public", ...(await status()) };
    if (s.status === "suppressed") return { status: "recipient-suppressed", ...(await status()) };
    const blocked = await db.prepare("SELECT id FROM deliveries WHERE subscriber_id=? AND (status IN ('sending','uncertain') OR error IN ('hardbounce','spam','invalid')) LIMIT 1")
      .bind(s.id).first();
    if (blocked) return { status: "test-release-requires-reconciliation", ...(await status()) };
    const now = new Date().toISOString(), markerId = `test-release:${s.id}`;
    const payload = JSON.stringify({ kind: "mail-test-release", requestId: crypto.randomUUID(),
      previousCreatedAt: s.created_at });
    const oldExpiry = Date.parse(s.token_expires || "");
    const expires = new Date(Math.max(Date.parse(now) + 86400000,
      Number.isFinite(oldExpiry) ? oldExpiry + 1 : 0)).toISOString();
    await db.batch([
      // Calculate the new epoch inside the winning transaction, after every
      // old producer. A same-millisecond or late callback stays historical.
      db.prepare("INSERT OR IGNORE INTO editions(id,payload,created_at,is_test) SELECT ?,?,strftime('%Y-%m-%dT%H:%M:%fZ',max(?,s.created_at,COALESCE((SELECT max(d.created_at) FROM deliveries d WHERE d.subscriber_id=s.id),'')),'+0.001 seconds'),1 FROM subscribers s WHERE s.id=? AND lower(s.email)=? AND s.created_at=? AND s.is_test=1 AND s.status<>'suppressed' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND (d.status IN ('sending','uncertain') OR d.error IN ('hardbounce','spam','invalid')))")
        .bind(markerId, payload, now, s.id, recipient, s.created_at),
      // Rotate both HMAC clocks, preserve preferences and all is_test history,
      // and require a subsequent public request plus new mailbox confirmation.
      db.prepare("UPDATE subscribers SET is_test=0,status='unsubscribed',confirmed_at=NULL,created_at=(SELECT e.created_at FROM editions e WHERE e.id=? AND e.is_test=1 AND e.payload=?),token_expires=max(?,(SELECT strftime('%Y-%m-%dT%H:%M:%fZ',e.created_at,'+1 day') FROM editions e WHERE e.id=? AND e.is_test=1 AND e.payload=?)) WHERE id=? AND lower(email)=? AND created_at=? AND is_test=1 AND status<>'suppressed' AND EXISTS (SELECT 1 FROM editions e WHERE e.id=? AND e.is_test=1 AND e.payload=?)")
        .bind(markerId, payload, expires, markerId, payload, s.id, recipient, s.created_at, markerId, payload),
      db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND status='queued' AND EXISTS (SELECT 1 FROM subscribers s JOIN editions e ON e.id=? AND e.is_test=1 AND e.payload=? WHERE s.id=deliveries.subscriber_id AND s.is_test=0 AND s.status='unsubscribed' AND s.created_at=e.created_at)")
        .bind(now, s.id, markerId, payload),
    ]);
    const recorded = await db.prepare("SELECT payload FROM editions WHERE id=? AND is_test=1")
      .bind(markerId).first<{ payload: string }>();
    s = await db.prepare("SELECT * FROM subscribers WHERE email=?").bind(recipient).first<Subscriber>();
    restart = await readRestart();
    return { status: recorded?.payload === payload ? "released" : s?.is_test === 0 ? "already-public" : "test-release-unavailable", ...(await status()) };
  }
  if (!ready) return { status: "test-not-configured", ...(await status()) };
  if (!a.runId) throw new Error("A stable test runId is required");
  // Ordinary send calls never repurpose a real subscriber or undo an opt-out.
  if (s && s.is_test !== 1) throw new Error("Test recipient is already a production subscriber");
  if (a.action === "restart") {
    if (c.enabled) return { status: "public-email-enabled", ...(await status()) };
    if (!s) return { status: "test-recipient-not-unsubscribed", ...(await status()) };
    if (s.status === "suppressed") return { status: "recipient-suppressed", ...(await status()) };
    const markerId = `test-restart:${s.id}:${a.runId}`;
    const existingMarker = await db.prepare("SELECT id FROM editions WHERE id=? AND is_test=1")
      .bind(markerId).first();
    if (existingMarker) return { status: "restart-already-recorded", ...(await status()) };
    if (s.status !== "unsubscribed")
      return { status: "test-recipient-not-unsubscribed", ...(await status()) };
    const runPrefix = `test:${a.runId}:${s.id}:`, editionId = `test:${a.runId}:${s.id}`;
    const oldRun = await db.prepare("SELECT id FROM deliveries WHERE subscriber_id=? AND is_test=1 AND substr(id,1,length(?))=? UNION ALL SELECT id FROM editions WHERE id=? AND is_test=1 LIMIT 1")
      .bind(s.id, runPrefix, runPrefix, editionId).first();
    if (oldRun) return { status: "test-run-already-used", ...(await status()) };
    const unresolved = await db.prepare("SELECT id FROM deliveries WHERE subscriber_id=? AND is_test=1 AND status IN ('sending','uncertain') LIMIT 1")
      .bind(s.id).first();
    if (unresolved) return { status: "test-restart-requires-reconciliation", ...(await status()) };
    const now = new Date().toISOString();
    const epoch = new Date(Math.max(Date.parse(now), Date.parse(s.created_at) + 1,
      restart ? Date.parse(restart.created_at) + 1 : 0)).toISOString();
    const payload = JSON.stringify({ kind: "mail-test-restart", runId: a.runId,
      requestId: crypto.randomUUID(), previousCreatedAt: s.created_at,
      previousTokenExpires: s.token_expires });
    await db.batch([
      // A test-only edition marker records consent to a new acceptance run;
      // it is never a queued delivery and cannot cause mail to be sent.
      db.prepare("INSERT OR IGNORE INTO editions(id,payload,created_at,is_test) SELECT ?,?,?,1 FROM subscribers s WHERE s.id=? AND lower(s.email)=? AND s.created_at=? AND s.is_test=1 AND s.status='unsubscribed' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=1 AND d.status IN ('sending','uncertain')) AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=1 AND substr(d.id,1,length(?))=?) AND NOT EXISTS (SELECT 1 FROM editions e WHERE e.id=? AND e.is_test=1)")
        .bind(markerId, payload, epoch, s.id, recipient, s.created_at, runPrefix, runPrefix, editionId),
      // The random marker payload binds changes to this transaction's winner,
      // so replaying a recorded run can never reopen it after another opt-out.
      db.prepare("UPDATE subscribers SET status='pending',created_at=?,confirmed_at=NULL,token_expires=NULL,locale=?,topics=? WHERE id=? AND lower(email)=? AND created_at=? AND is_test=1 AND status='unsubscribed' AND EXISTS (SELECT 1 FROM editions e WHERE e.id=? AND e.is_test=1 AND e.payload=?)")
        .bind(epoch, a.locale, JSON.stringify(a.topics), s.id, recipient, s.created_at, markerId, payload),
      db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND is_test=1 AND status='queued' AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=? AND s.is_test=1 AND s.status='pending' AND s.created_at=?) AND EXISTS (SELECT 1 FROM editions e WHERE e.id=? AND e.is_test=1 AND e.payload=?)")
        .bind(now, s.id, s.id, epoch, markerId, payload),
    ]);
    const recorded = await db.prepare("SELECT payload FROM editions WHERE id=? AND is_test=1")
      .bind(markerId).first<{ payload: string }>();
    s = await db.prepare("SELECT * FROM subscribers WHERE email=?").bind(recipient).first<Subscriber>();
    restart = await readRestart();
    return { status: recorded?.payload === payload ? "restarted" : recorded ? "restart-already-recorded" : "test-restart-unavailable", ...(await status()) };
  }
  if (s && ["suppressed", "unsubscribed"].includes(s.status))
    return { status: "recipient-suppressed", ...(await status()) };
  if (restartData() && restartData()!.runId !== a.runId)
    return { status: "stale-test-run", ...(await status()) };
  const now = new Date().toISOString();
  if (!s) {
    if (a.action !== "confirmation") throw new Error("Confirm the test mailbox first");
    await db.prepare(
      "INSERT OR IGNORE INTO subscribers(id,email,locale,topics,status,created_at,token_expires,is_test) VALUES(?,?,?,?,'pending',?,?,1)",
    ).bind(crypto.randomUUID(), recipient, a.locale, JSON.stringify(a.topics), now,
      new Date(Date.now() + 86400000).toISOString()).run();
    s = await db.prepare("SELECT * FROM subscribers WHERE email=?").bind(recipient).first<Subscriber>();
    if (!s || s.is_test !== 1) throw new Error("Test recipient unavailable");
  }
  const kind = a.action === "confirmation" ? "confirmation" : "weekly";
  const runArgs = [a.runId, a.runId];
  const deliveryId = `test:${a.runId}:${s.id}:${kind}`;
  const existing = await db.prepare("SELECT id FROM deliveries WHERE id=?").bind(deliveryId).first();
  if (!existing) {
    if (kind === "confirmation") {
      if (s.status !== "pending") return { status: "already-confirmed", ...(await status()) };
      // A new run ID is not permission to retry an uncertain submission or
      // create another live confirmation. Expired, known submissions may be
      // replaced by an explicitly requested new run.
      const unresolved = await db.prepare(
        "SELECT id FROM deliveries WHERE subscriber_id=? AND is_test=1 AND kind='confirmation' AND (status IN ('sending','uncertain') OR (status IN ('queued','submitted','delivered') AND ? > ?)) LIMIT 1",
      ).bind(s.id, s.token_expires || "", now).first();
      if (unresolved) return { status: "confirmation-already-pending", ...(await status()) };
      const previousExpiry = Date.parse(restartData()?.previousTokenExpires || "");
      // Restarting in the same millisecond must not recreate an old token.
      const expires = new Date(Math.max(Date.parse(now) + 86400000,
        restart ? Date.parse(s.created_at) + 86400000 : 0,
        Number.isFinite(previousExpiry) ? previousExpiry + 1 : 0)).toISOString();
      await db.batch([
        // D1 executes the batch transactionally: a second run must observe the
        // winner before it can create a live confirmation for this recipient.
        db.prepare(`INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at,is_test) SELECT ?,s.id,'confirmation','queued',?,?,1 FROM subscribers s WHERE s.id=? AND lower(s.email)=? AND s.is_test=1 AND s.status='pending' AND ${activeTestRunSql} AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=1 AND d.kind='confirmation' AND (d.status IN ('sending','uncertain') OR (d.status IN ('queued','submitted','delivered') AND s.token_expires>?)))`)
          .bind(deliveryId, now, now, s.id, recipient, ...runArgs, now),
        // created_at ties expiry rotation to this successful insertion. A
        // same-millisecond replay computes the identical expiry, so cannot
        // invalidate the winner's link. Later replays cannot rotate it.
        db.prepare(`UPDATE subscribers SET token_expires=? WHERE id=? AND is_test=1 AND status='pending' AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=subscribers.id AND ${activeTestRunSql}) AND EXISTS (SELECT 1 FROM deliveries d WHERE d.id=? AND d.created_at=? AND d.status='queued')`)
          .bind(expires, s.id, ...runArgs, deliveryId, now),
        db.prepare(`UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND is_test=1 AND kind='confirmation' AND status='queued' AND id<>? AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=deliveries.subscriber_id AND ${activeTestRunSql}) AND EXISTS (SELECT 1 FROM deliveries winner WHERE winner.id=? AND winner.created_at=? AND winner.status='queued')`)
          .bind(now, s.id, deliveryId, ...runArgs, deliveryId, now),
      ]);
    } else {
      if (s.status !== "confirmed") throw new Error("Confirm the test mailbox first");
      const topics: string[] = JSON.parse(s.topics);
      const items = (await articles(db)).filter((x) => topics.includes(x.category)).slice(0, 5);
      if (!items.length) return { status: "empty", ...(await status()) };
      const editionId = `test:${a.runId}:${s.id}`;
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO editions(id,payload,created_at,is_test) SELECT ?,?,?,1 FROM subscribers s WHERE s.id=? AND lower(s.email)=? AND s.is_test=1 AND s.status='confirmed' AND ${activeTestRunSql}`)
          .bind(editionId, JSON.stringify({ items, through: now }), now, s.id, recipient, ...runArgs),
        db.prepare(`INSERT OR IGNORE INTO deliveries(id,subscriber_id,edition_id,kind,status,created_at,updated_at,is_test) SELECT ?,s.id,?,'weekly','queued',?,?,1 FROM subscribers s WHERE s.id=? AND lower(s.email)=? AND s.is_test=1 AND s.status='confirmed' AND ${activeTestRunSql}`)
          .bind(deliveryId, editionId, now, now, s.id, recipient, ...runArgs),
      ]);
    }
  }
  const result = await deliverQueued(db, c, 1, { deliveryId, recipient, runId: a.runId });
  s = await db.prepare("SELECT * FROM subscribers WHERE id=?").bind(s.id).first<Subscriber>();
  return { ...result, ...(await status()) };
}
export async function drainQueue(db: Database, c: MailConfig, limit = 25) {
  if (!mailReady(c)) return { status: "pending-activation", submitted: 0 };
  return deliverQueued(db, c, limit);
}
async function deliverQueued(
  db: Database,
  c: MailConfig,
  limit: number,
  test?: { deliveryId: string; recipient: string; runId: string },
) {
  if (test ? !mailTestReady(c) : !mailReady(c))
    return { status: "pending-activation", submitted: 0 };
  let submitted = 0;
  const scope = test
    ? `d.is_test=1 AND s.is_test=1 AND d.id=? AND lower(s.email)=? AND ${activeTestRunSql}`
    : "d.is_test=0 AND s.is_test=0 AND d.created_at>=s.created_at";
  const scopeArgs = test ? [test.deliveryId, test.recipient, test.runId, test.runId] : [];
  // A process lost after submission may have sent mail. Never blindly retry it.
  await db
    .prepare(
      `UPDATE deliveries SET status='uncertain',error='Interrupted during submission; reconcile provider logs',updated_at=? WHERE status='sending' AND attempted_at<? AND id IN (SELECT d.id FROM deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE ${scope})`,
    )
    .bind(new Date().toISOString(), new Date(Date.now() - 600000).toISOString(), ...scopeArgs)
    .run();
  const rows = (
    await db
      .prepare(
        `SELECT d.*,s.email,s.locale,s.topics,s.status AS subscriber_status,s.created_at AS subscriber_created,s.token_expires FROM deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE d.status='queued' AND ${scope} ORDER BY CASE d.kind WHEN 'confirmation' THEN 0 ELSE 1 END,d.created_at LIMIT ?`,
      )
      .bind(...scopeArgs, Math.min(limit, 50))
      .all<Record<string, string>>()
  ).results;
  for (const d of rows) {
    if (test && d.email.toLowerCase() !== c.testRecipient?.trim().toLowerCase()) continue;
    if (
      (d.kind === "weekly" && d.subscriber_status !== "confirmed") ||
      (d.kind === "confirmation" &&
        (d.subscriber_status !== "pending" ||
          Date.parse(d.token_expires) < Date.now()))
    ) {
      await db
        .prepare("UPDATE deliveries SET status='cancelled' WHERE id=?")
        .bind(d.id)
        .run();
      continue;
    }
    const now = new Date().toISOString(),
      day = singaporeDay();
    const claim = await db
      .prepare(
        `UPDATE deliveries SET status='sending',attempted_at=?,updated_at=? WHERE id=? AND status='queued' AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=deliveries.subscriber_id AND ((deliveries.kind='weekly' AND s.status='confirmed') OR (deliveries.kind='confirmation' AND s.status='pending' AND s.token_expires>?))${test ? ` AND s.is_test=1 AND deliveries.is_test=1 AND lower(s.email)=? AND ${activeTestRunSql}` : " AND s.is_test=0 AND deliveries.is_test=0 AND deliveries.created_at>=s.created_at AND s.created_at=? AND (deliveries.kind<>'confirmation' OR s.token_expires=?)"}) RETURNING id`,
      )
      .bind(now, now, d.id, now, ...(test ? [test.recipient, test.runId, test.runId] : [d.subscriber_created, d.token_expires]))
      .first();
    if (!claim) continue;
    const quota = await db
      .prepare(
        "INSERT INTO mail_quota(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
      )
      .bind(day, d.kind === "confirmation" ? DAILY_EMAIL_LIMIT : WEEKLY_EMAIL_LIMIT)
      .first();
    if (!quota) {
      await db
        .prepare(
          "UPDATE deliveries SET status='queued' WHERE id=? AND status='sending'",
        )
        .bind(d.id)
        .run();
      continue;
    }
    const s = {
      id: d.subscriber_id,
      created_at: d.subscriber_created,
      token_expires: d.token_expires,
    } as Subscriber;
    const manage = `https://ag-ui.ai/${d.locale}/subscribe?id=${s.id}&token=${await tokenFor(s, c.secret)}`;
    let rendered;
    if (d.kind === "confirmation") {
      const link = `https://ag-ui.ai/${d.locale}/subscribe?action=confirm&id=${s.id}&token=${await tokenFor(s, c.secret, "confirm")}`;
      rendered = renderMail({ locale: d.locale as "en" | "zh", kind: "confirmation",
        confirmUrl: link, manageUrl: manage, test: !!test });
    } else {
      const ed = await db
        .prepare("SELECT payload FROM editions WHERE id=?")
        .bind(d.edition_id)
        .first<{ payload: string }>();
      const topics: string[] = JSON.parse(d.topics);
      const items: NewsItem[] = ed ? JSON.parse(ed.payload).items : [];
      const selected = items.filter((x) => topics.includes(x.category));
      rendered = renderMail({ locale: d.locale as "en" | "zh", kind: "weekly",
        editionId: d.edition_id, items: selected, manageUrl: manage, test: !!test });
    }
    const { subject, html, text } = rendered;
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": c.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "AG-UI.AI", email: c.sender },
          to: [{ email: d.email }],
          subject,
          htmlContent: html,
          textContent: text,
          headers: { "X-Mailin-custom": `delivery:${d.id}` },
          tags: ["ag-ui-weekly"],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const status =
          response.status === 429
            ? "queued"
            : response.status >= 500
              ? "uncertain"
              : "failed";
        await db
          .prepare(
            "UPDATE deliveries SET status=?,error=?,updated_at=? WHERE id=?",
          )
          .bind(status, `Brevo HTTP ${response.status}`, now, d.id)
          .run();
        if (response.status === 429) break;
        continue;
      }
      const result = (await response.json()) as { messageId?: string };
      await db
        .prepare(
          "UPDATE deliveries SET status='submitted',provider_id=?,updated_at=? WHERE id=? AND status='sending'",
        )
        .bind(result.messageId || null, now, d.id)
        .run();
      submitted++;
    } catch {
      await db
        .prepare(
          "UPDATE deliveries SET status='uncertain',error='Submission response unknown; do not retry automatically',updated_at=? WHERE id=? AND status='sending'",
        )
        .bind(now, d.id)
        .run();
    }
  }
  return { status: "processed", submitted };
}
export async function mailWebhook(db: Database, input: unknown) {
  const events = z
    .array(
      z.object({
        event: z.string(),
        email: z.string().email(),
        "message-id": z.string().optional(),
        "X-Mailin-custom": z.string().optional(),
      }),
    )
    .max(100)
    .parse(Array.isArray(input) ? input : [input]);
  for (const e of events) {
    const normalized = e.event.toLowerCase().replaceAll("_", "");
    // Brevo's webhook payload calls the invalid-address event invalid_email,
    // while subscriptions and older payloads use invalid.
    const event = normalized === "invalidemail" ? "invalid" : normalized;
    const stop = ["hardbounce", "spam", "unsubscribed", "invalid"].includes(
      event,
    );
    const state =
      event === "delivered"
        ? "delivered"
        : stop || ["softbounce", "blocked", "error"].includes(event)
          ? "failed"
          : null;
    const deliveryId=e['X-Mailin-custom']?.match(/^delivery:(.+)$/)?.[1]||'';
    if (stop)
      await db.batch([
        db
          // A late opt-out callback from an old signed-link generation must
          // not undo fresh consent. Uncorrelated opt-outs stay conservative;
          // complaints and hard failures always suppress every generation.
          .prepare(event === "unsubscribed"
            ? "UPDATE subscribers SET status=? WHERE email=? AND status<>'suppressed' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=subscribers.id AND (d.provider_id=? OR d.id=?) AND d.created_at<subscribers.created_at)"
            : "UPDATE subscribers SET status=? WHERE email=?")
          .bind(
            event === "unsubscribed" ? "unsubscribed" : "suppressed",
            e.email.toLowerCase(),
            ...(event === "unsubscribed" ? [e['message-id'] || '', deliveryId] : []),
          ),
        db
          .prepare(
            "UPDATE deliveries SET status='cancelled' WHERE status='queued' AND subscriber_id IN (SELECT id FROM subscribers WHERE email=? AND status IN ('unsubscribed','suppressed'))",
          )
          .bind(e.email.toLowerCase()),
      ]);
    if(state&&(e['message-id']||deliveryId)){
      // Authenticated callbacks can race the submission response. Resolve the
      // stable delivery reference, and never let delivery overwrite a failure.
      const allowed=state==='failed'?"('submitted','sending','uncertain','delivered')":"('submitted','sending','uncertain')";
      await db.prepare(`UPDATE deliveries SET status=?,provider_id=COALESCE(provider_id,?),updated_at=?,error=? WHERE (provider_id=? OR id=?) AND subscriber_id IN (SELECT id FROM subscribers WHERE email=?) AND status IN ${allowed}`).bind(state,e['message-id']||null,new Date().toISOString(),state==='failed'?event:null,e['message-id']||'',deliveryId,e.email.toLowerCase()).run();
    }
  }
  return { received: events.length };
}
