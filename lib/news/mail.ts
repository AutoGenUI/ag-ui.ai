import { z } from "zod";
import type { Database, NewsItem } from "./types";
import { categories } from "./types";
import { equalSecret, escapeHtml, hmac, singaporeDay } from "./core";
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
export function mailReady(c: MailConfig) {
  return (
    c.enabled && !!c.apiKey && !!c.sender && !!c.secret && !!c.webhookSecret
  );
}
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
  if (
    !(await rateLimit(db, `signup:${clientKey}`, 5)) ||
    !(await rateLimit(db, `email:${await hmac(email, c.secret)}`, 2, 86400000))
  )
    return { status: "check-inbox" };
  const now = new Date().toISOString(),
    expires = new Date(Date.parse(now) + 86400000).toISOString(),
    candidate = `confirm:${crypto.randomUUID()}`;
  await db.batch([
    // D1 serializes this batch. Concurrent callers use the actual email winner,
    // never a losing request's subscriber ID or confirmation expiry.
    db.prepare("INSERT OR IGNORE INTO subscribers(id,email,locale,topics,status,created_at,token_expires) VALUES(?,?,?,?,'pending',?,?)")
      .bind(crypto.randomUUID(), email, input.locale, JSON.stringify(input.topics), now, expires),
    // Any confirmation history protects a live token. An expired, known
    // generation can be replaced; sending/uncertain always requires review.
    db.prepare("INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at) SELECT ?,s.id,'confirmation','queued',?,? FROM subscribers s WHERE s.email=? AND s.is_test=0 AND s.status='pending' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=0 AND d.kind='confirmation' AND (d.status IN ('sending','uncertain') OR s.token_expires>?))")
      .bind(candidate, now, now, email, now),
    // Only the request that inserted a confirmation may change preferences or
    // start a new expiry; a valid expiry (and its HMAC) stays unchanged.
    db.prepare("UPDATE subscribers SET locale=?,topics=?,token_expires=CASE WHEN token_expires>? THEN token_expires ELSE ? END WHERE email=? AND is_test=0 AND status='pending' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.id=? AND d.subscriber_id=subscribers.id AND d.is_test=0 AND d.status='queued')")
      .bind(input.locale, JSON.stringify(input.topics), now, expires, email, candidate),
    // Cancel old queued generations before another worker can claim a stale
    // expiry snapshot. A worker that already claimed sending blocks rotation.
    db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE is_test=0 AND kind='confirmation' AND status='queued' AND id<>? AND subscriber_id IN (SELECT s.id FROM subscribers s WHERE s.email=? AND s.is_test=0 AND s.status='pending' AND EXISTS (SELECT 1 FROM deliveries winner WHERE winner.id=? AND winner.subscriber_id=s.id AND winner.is_test=0 AND winner.status='queued'))")
      .bind(now, candidate, email, candidate),
  ]);
  const subscriber = await db.prepare("SELECT status,is_test FROM subscribers WHERE email=?")
    .bind(email).first<{ status: string; is_test: number }>();
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
  if (action === "confirm") {
    if (!s.token_expires || Date.parse(s.token_expires) <= Date.now())
      throw new Error("Confirmation link expired");
    await db
      .prepare(
        "UPDATE subscribers SET status='confirmed',confirmed_at=COALESCE(confirmed_at,?) WHERE id=? AND status='pending'",
      )
      .bind(new Date().toISOString(), id)
      .run();
  } else if (action === "unsubscribe") {
    await db.batch([
      db
        .prepare("UPDATE subscribers SET status='unsubscribed' WHERE id=?")
        .bind(id),
      db
        .prepare(
          "UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND status='queued'",
        )
        .bind(new Date().toISOString(), id),
    ]);
  } else if (action === "preferences") {
    const p = preferenceSchema.parse(input);
    await db
      .prepare(
        "UPDATE subscribers SET locale=?,topics=? WHERE id=? AND status='confirmed'",
      )
      .bind(p.locale, JSON.stringify(p.topics), id)
      .run();
  }
  const current = await db
    .prepare("SELECT locale,topics,status FROM subscribers WHERE id=?")
    .bind(id)
    .first();
  return { ...current, token: await tokenFor(s, c.secret) };
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
    const now = new Date().toISOString();
    const r = await db
      .prepare(
        "INSERT OR IGNORE INTO deliveries(id,subscriber_id,edition_id,kind,status,created_at,updated_at) VALUES(?,?,?,'weekly','queued',?,?)",
      )
      .bind(`${week}:${s.id}`, s.id, week, now, now)
      .run();
    queued += r.meta.changes;
  }
  return { queued, edition: week };
}
// This entry point is exposed only by the existing owner-authenticated MCP and
// admin operation dispatcher. It cannot take an email address or change gates.
export async function mailTest(
  db: Database,
  input: unknown,
  c: MailConfig,
) {
  const a = z.object({
    action: z.enum(["status", "confirmation", "weekly"]),
    runId: z.string().regex(/^[a-z0-9-]{8,80}$/).optional(),
    locale: z.enum(["en", "zh"]).default("zh"),
    topics: z.array(z.enum(categories)).min(1).max(6).default([...categories]),
  }).strict().parse(input);
  const ready = mailTestReady(c);
  const recipient = c.testRecipient?.trim().toLowerCase() || "";
  let s = await db.prepare("SELECT * FROM subscribers WHERE email=?")
    .bind(recipient).first<Subscriber>();
  const status = async () => ({
    ready,
    publicEnabled: mailReady(c),
    subscriberStatus: s?.is_test === 1 ? s.status : null,
    deliveries: s?.is_test === 1 ? (await db.prepare(
      "SELECT kind,status,attempted_at,updated_at,error FROM deliveries WHERE subscriber_id=? AND is_test=1 ORDER BY created_at DESC LIMIT 20",
    ).bind(s.id).all()).results : [],
  });
  if (a.action === "status") return status();
  if (!ready) return { status: "test-not-configured", ...(await status()) };
  if (!a.runId) throw new Error("A stable test runId is required");
  // Never repurpose a real subscriber, nor undo a test recipient's opt-out.
  if (s && s.is_test !== 1) throw new Error("Test recipient is already a production subscriber");
  if (s && ["suppressed", "unsubscribed"].includes(s.status))
    return { status: "recipient-suppressed", ...(await status()) };
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
      const expires = new Date(Date.parse(now) + 86400000).toISOString();
      await db.batch([
        // D1 executes the batch transactionally: a second run must observe the
        // winner before it can create a live confirmation for this recipient.
        db.prepare("INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at,is_test) SELECT ?,s.id,'confirmation','queued',?,?,1 FROM subscribers s WHERE s.id=? AND s.is_test=1 AND s.status='pending' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.subscriber_id=s.id AND d.is_test=1 AND d.kind='confirmation' AND (d.status IN ('sending','uncertain') OR (d.status IN ('queued','submitted','delivered') AND s.token_expires>?)))")
          .bind(deliveryId, now, now, s.id, now),
        // created_at ties expiry rotation to this successful insertion. A
        // same-millisecond replay computes the identical expiry, so cannot
        // invalidate the winner's link. Later replays cannot rotate it.
        db.prepare("UPDATE subscribers SET token_expires=? WHERE id=? AND is_test=1 AND status='pending' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.id=? AND d.created_at=? AND d.status='queued')")
          .bind(expires, s.id, deliveryId, now),
        db.prepare("UPDATE deliveries SET status='cancelled',updated_at=? WHERE subscriber_id=? AND is_test=1 AND kind='confirmation' AND status='queued' AND id<>? AND EXISTS (SELECT 1 FROM deliveries winner WHERE winner.id=? AND winner.created_at=? AND winner.status='queued')")
          .bind(now, s.id, deliveryId, deliveryId, now),
      ]);
    } else {
      if (s.status !== "confirmed") throw new Error("Confirm the test mailbox first");
      const topics: string[] = JSON.parse(s.topics);
      const items = (await articles(db)).filter((x) => topics.includes(x.category)).slice(0, 5);
      if (!items.length) return { status: "empty", ...(await status()) };
      const editionId = `test:${a.runId}:${s.id}`;
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO editions(id,payload,created_at,is_test) VALUES(?,?,?,1)")
          .bind(editionId, JSON.stringify({ items, through: now }), now),
        db.prepare("INSERT OR IGNORE INTO deliveries(id,subscriber_id,edition_id,kind,status,created_at,updated_at,is_test) VALUES(?,?,?,'weekly','queued',?,?,1)")
          .bind(deliveryId, s.id, editionId, now, now),
      ]);
    }
  }
  const result = await deliverQueued(db, c, 1, { deliveryId, recipient });
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
  test?: { deliveryId: string; recipient: string },
) {
  if (test ? !mailTestReady(c) : !mailReady(c))
    return { status: "pending-activation", submitted: 0 };
  let submitted = 0;
  const scope = test
    ? "d.is_test=1 AND s.is_test=1 AND d.id=? AND lower(s.email)=?"
    : "d.is_test=0 AND s.is_test=0";
  const scopeArgs = test ? [test.deliveryId, test.recipient] : [];
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
        "UPDATE deliveries SET status='sending',attempted_at=?,updated_at=? WHERE id=? AND status='queued' AND EXISTS (SELECT 1 FROM subscribers s WHERE s.id=deliveries.subscriber_id AND ((deliveries.kind='weekly' AND s.status='confirmed') OR (deliveries.kind='confirmation' AND s.status='pending' AND s.token_expires>?))) RETURNING id",
      )
      .bind(now, now, d.id, now)
      .first();
    if (!claim) continue;
    const quota = await db
      .prepare(
        "INSERT INTO mail_quota(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
      )
      .bind(day, d.kind === "confirmation" ? 300 : 250)
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
    const copyInstruction = d.locale === "zh"
      ? "如果按钮打不开，请复制下面的网址文字并粘贴到浏览器地址栏。直接点击或邮箱自动识别的链接仍可能经过 Brevo 跟踪。"
      : "If a button will not open, copy the URL text below and paste it into your browser's address bar. Clicked or automatically detected email links may still pass through Brevo tracking.";
    const copyableUrl = (url: string) => `<p>${escapeHtml(copyInstruction)}</p><p><span style="overflow-wrap:anywhere;word-break:break-all">${escapeHtml(url)}</span></p>`;
    const manageLabel = d.locale === "zh" ? "退订 / 修改偏好" : "Unsubscribe / preferences";
    let subject, html, text;
    if (d.kind === "confirmation") {
      subject =
        d.locale === "zh"
          ? "确认订阅 AG-UI.AI"
          : "Confirm your AG-UI.AI subscription";
      const link = `https://ag-ui.ai/${d.locale}/subscribe?action=confirm&id=${s.id}&token=${await tokenFor(s, c.secret, "confirm")}`;
      const confirmLabel = d.locale === "zh" ? "确认邮箱（24 小时内有效）" : "Confirm email (valid for 24 hours)";
      html = `<p>${subject}</p><p><a href="${escapeHtml(link)}">${confirmLabel}</a></p>${copyableUrl(link)}`;
      text = `${subject}\n\n${confirmLabel}\n${copyInstruction}\n${link}`;
    } else {
      const ed = await db
        .prepare("SELECT payload FROM editions WHERE id=?")
        .bind(d.edition_id)
        .first<{ payload: string }>();
      const topics: string[] = JSON.parse(d.topics);
      const items: NewsItem[] = ed ? JSON.parse(ed.payload).items : [];
      subject = `AG-UI.AI · ${d.locale === "zh" ? "生成式 UI 周报" : "Generative UI weekly"} · ${d.edition_id}`;
      const selected = items.filter((x) => topics.includes(x.category));
      html = selected
        .map(
          (x) =>
            `<h2><a href="https://ag-ui.ai/${d.locale}/news/${x.slug}">${escapeHtml(x[d.locale as "en" | "zh"].title)}</a></h2><p>${escapeHtml(x[d.locale as "en" | "zh"].summary)}</p>`,
        )
        .join("");
      text = `${subject}\n\n${selected.map((x) => `${x[d.locale as "en" | "zh"].title}\n${x[d.locale as "en" | "zh"].summary}\nhttps://ag-ui.ai/${d.locale}/news/${x.slug}`).join("\n\n")}`;
    }
    html += `<p><a href="${escapeHtml(manage)}">${manageLabel}</a></p>${copyableUrl(manage)}<p>AG-UI.AI · Independent Generative UI intelligence · Sent with Brevo</p>`;
    text += `\n\n${manageLabel}\n${copyInstruction}\n${manage}\n\nAG-UI.AI · Independent Generative UI intelligence · Sent with Brevo`;
    if (test) {
      subject = `[${d.locale === "zh" ? "验收测试" : "Acceptance test"}] ${subject}`;
      const testNotice = d.locale === "zh" ? "这是所有者授权的邮件验收测试，不会将此邮箱加入正式周报名单。" : "This owner-authorized acceptance test does not add this mailbox to the production newsletter.";
      html += `<p>${testNotice}</p>`;
      text += `\n\n${testNotice}`;
    }
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
    if (stop)
      await db.batch([
        db
          .prepare("UPDATE subscribers SET status=? WHERE email=?")
          .bind(
            event === "unsubscribed" ? "unsubscribed" : "suppressed",
            e.email.toLowerCase(),
          ),
        db
          .prepare(
            "UPDATE deliveries SET status='cancelled' WHERE status='queued' AND subscriber_id IN (SELECT id FROM subscribers WHERE email=?)",
          )
          .bind(e.email.toLowerCase()),
      ]);
    const deliveryId=e['X-Mailin-custom']?.match(/^delivery:(.+)$/)?.[1]||'';
    if(state&&(e['message-id']||deliveryId)){
      // Authenticated callbacks can race the submission response. Resolve the
      // stable delivery reference, and never let delivery overwrite a failure.
      const allowed=state==='failed'?"('submitted','sending','uncertain','delivered')":"('submitted','sending','uncertain')";
      await db.prepare(`UPDATE deliveries SET status=?,provider_id=COALESCE(provider_id,?),updated_at=?,error=? WHERE (provider_id=? OR id=?) AND subscriber_id IN (SELECT id FROM subscribers WHERE email=?) AND status IN ${allowed}`).bind(state,e['message-id']||null,new Date().toISOString(),state==='failed'?event:null,e['message-id']||'',deliveryId,e.email.toLowerCase()).run();
    }
  }
  return { received: events.length };
}
