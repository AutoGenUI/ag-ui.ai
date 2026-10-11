import { z } from "zod";
import { hmac, singaporeDay } from "./core";
import { rateLimit } from "./store";
import type { Database } from "./types";
export const metricSchema = z.object({
  id: z.string().uuid(),
  path: z
    .string()
    .regex(/^\/(en|zh)(\/[^?#]*)?$/)
    .max(240),
  kind: z.enum(["view", "engaged", "source"]),
  source: z.string().url().max(1000).optional(),
});
export async function recordMetric(
  db: Database,
  request: Request,
  input: unknown,
  secret: string,
) {
  const ua = request.headers.get("user-agent") || "";
  const host = new URL(request.url).hostname;
  if (
    !secret ||
    /localhost|127\.0\.0\.1/.test(host) ||
    /bot|crawler|spider|headless|playwright|preview|curl|wget/i.test(ua) ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") ||
    request.headers.has("oai-authenticated-user-id")
  )
    return { recorded: false };
  const data = metricSchema.parse(input),
    day = singaporeDay();
  const visitor = await hmac(
    `${day}:${request.headers.get("cf-connecting-ip") || "unknown"}:${ua.slice(0, 200)}`,
    secret,
  );
  if (!(await rateLimit(db, `stats:${visitor}`, 300)))
    return { recorded: false };
  if (
    data.kind !== "view" &&
    !(await db
      .prepare("SELECT id FROM stats_events WHERE id=? AND visitor=?")
      .bind(`${data.id}:view`, visitor)
      .first())
  )
    return { recorded: false };
  let source = null;
  if (data.kind === "source" && data.source) {
    const u = new URL(data.source);
    if (u.protocol !== "https:") return { recorded: false };
    source = u.origin + u.pathname;
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO stats_events(id,day,path,kind,visitor,source,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      `${data.id}:${data.kind}`,
      day,
      data.path,
      data.kind,
      visitor,
      source,
      new Date().toISOString(),
    )
    .run();
  return { recorded: true };
}
export async function statsSummary(db: Database, owner = false) {
  const totals = await db
    .prepare(
      "SELECT count(*) AS views,min(created_at) AS startedAt FROM stats_events WHERE kind='view'",
    )
    .first();
  const today = await db
    .prepare(
      "SELECT count(DISTINCT visitor) AS visitors FROM stats_events WHERE day=? AND kind='view'",
    )
    .bind(singaporeDay())
    .first();
  const result = {
    ...totals,
    todayVisitors: Number(today?.visitors || 0),
    visitorMethod: "daily salted estimate",
    timezone: "Asia/Singapore",
  };
  if (!owner) return result;
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return {
    ...result,
    daily: (
      await db
        .prepare(
          "SELECT day,sum(kind='view') AS views,count(DISTINCT CASE WHEN kind='view' THEN visitor END) AS visitors,sum(kind='engaged') AS engaged FROM stats_events WHERE day>=? GROUP BY day ORDER BY day",
        )
        .bind(since)
        .all()
    ).results,
    popular: (
      await db
        .prepare(
          "SELECT path,count(*) AS views FROM stats_events WHERE day>=? AND kind='view' GROUP BY path ORDER BY views DESC LIMIT 20",
        )
        .bind(since)
        .all()
    ).results,
    sourceClicks: (
      await db
        .prepare(
          "SELECT source,count(*) AS clicks FROM stats_events WHERE day>=? AND kind='source' GROUP BY source ORDER BY clicks DESC LIMIT 20",
        )
        .bind(since)
        .all()
    ).results,
    confirmed: (
      await db
        .prepare(
          "SELECT substr(confirmed_at,1,10) AS day,count(*) AS confirmed FROM subscribers WHERE is_test=0 AND confirmed_at>=? GROUP BY day",
        )
        .bind(since)
        .all()
    ).results,
  };
}
