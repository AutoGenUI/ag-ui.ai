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
};
export function mailReady(c: MailConfig) {
  return (
    c.enabled && !!c.apiKey && !!c.sender && !!c.secret && !!c.webhookSecret
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
  let s = await db
    .prepare("SELECT * FROM subscribers WHERE email=?")
    .bind(email)
    .first<Subscriber>();
  if (s && s.status !== "pending") return { status: "check-inbox" };
  const now = new Date().toISOString(),
    expires = new Date(Date.now() + 86400000).toISOString();
  if (!s) {
    s = {
      id: crypto.randomUUID(),
      email,
      locale: input.locale,
      topics: JSON.stringify(input.topics),
      status: "pending",
      created_at: now,
      token_expires: expires,
    };
    await db
      .prepare(
        "INSERT INTO subscribers(id,email,locale,topics,status,created_at,token_expires) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(s.id, email, s.locale, s.topics, s.status, now, expires)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE subscribers SET locale=?,topics=?,token_expires=? WHERE id=?",
      )
      .bind(input.locale, JSON.stringify(input.topics), expires, s.id)
      .run();
    s = {
      ...s,
      locale: input.locale,
      topics: JSON.stringify(input.topics),
      token_expires: expires,
    };
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at) VALUES(?,?,'confirmation','queued',?,?)",
    )
    .bind(`confirm:${s.id}:${singaporeDay()}`, s.id, now, now)
    .run();
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
    if (!s.token_expires || Date.parse(s.token_expires) < Date.now())
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
      .prepare("SELECT payload FROM editions ORDER BY id DESC LIMIT 1")
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
      .prepare("SELECT * FROM subscribers WHERE status='confirmed'")
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
export async function drainQueue(db: Database, c: MailConfig, limit = 25) {
  if (!mailReady(c)) return { status: "pending-activation", submitted: 0 };
  let submitted = 0;
  // A process lost after submission may have sent mail. Never blindly retry it.
  await db
    .prepare(
      "UPDATE deliveries SET status='uncertain',error='Interrupted during submission; reconcile provider logs',updated_at=? WHERE status='sending' AND attempted_at<?",
    )
    .bind(new Date().toISOString(), new Date(Date.now() - 600000).toISOString())
    .run();
  const rows = (
    await db
      .prepare(
        "SELECT d.*,s.email,s.locale,s.topics,s.status AS subscriber_status,s.created_at AS subscriber_created,s.token_expires FROM deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE d.status='queued' ORDER BY CASE d.kind WHEN 'confirmation' THEN 0 ELSE 1 END,d.created_at LIMIT ?",
      )
      .bind(Math.min(limit, 50))
      .all<Record<string, string>>()
  ).results;
  for (const d of rows) {
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
        "UPDATE deliveries SET status='sending',attempted_at=?,updated_at=? WHERE id=? AND status='queued' RETURNING id",
      )
      .bind(now, now, d.id)
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
    let subject, html;
    if (d.kind === "confirmation") {
      subject =
        d.locale === "zh"
          ? "确认订阅 AG-UI.AI"
          : "Confirm your AG-UI.AI subscription";
      const link = `https://ag-ui.ai/${d.locale}/subscribe?action=confirm&id=${s.id}&token=${await tokenFor(s, c.secret, "confirm")}`;
      html = `<p>${subject}</p><p><a href="${escapeHtml(link)}">${d.locale === "zh" ? "确认邮箱（24 小时内有效）" : "Confirm email (valid for 24 hours)"}</a></p>`;
    } else {
      const ed = await db
        .prepare("SELECT payload FROM editions WHERE id=?")
        .bind(d.edition_id)
        .first<{ payload: string }>();
      const topics: string[] = JSON.parse(d.topics);
      const items: NewsItem[] = ed ? JSON.parse(ed.payload).items : [];
      subject = `AG-UI.AI · ${d.locale === "zh" ? "生成式 UI 周报" : "Generative UI weekly"} · ${d.edition_id}`;
      html = items
        .filter((x) => topics.includes(x.category))
        .map(
          (x) =>
            `<h2><a href="https://ag-ui.ai/${d.locale}/news/${x.slug}">${escapeHtml(x[d.locale as "en" | "zh"].title)}</a></h2><p>${escapeHtml(x[d.locale as "en" | "zh"].summary)}</p>`,
        )
        .join("");
    }
    html += `<p><a href="${escapeHtml(manage)}">${d.locale === "zh" ? "退订 / 修改偏好" : "Unsubscribe / preferences"}</a></p><p>AG-UI.AI · Independent Generative UI intelligence · Sent with Brevo</p>`;
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": c.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "AG-UI.AI", email: c.sender },
          to: [{ email: d.email }],
          subject,
          htmlContent: html,
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
    const event = e.event.toLowerCase().replaceAll("_", "");
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
