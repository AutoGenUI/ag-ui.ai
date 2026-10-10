import { z } from "zod";
import {
  articles,
  freshness,
  seedDatabase,
  sourceDirectory,
  trendList,
  upsertNews,
} from "./store";
import { publicUrl, singaporeDay } from "./core";
import { statsSummary } from "./analytics";
import { drainQueue, mailReady, queueDigest, type MailConfig } from "./mail";
import type { Database, Trend } from "./types";
export const operations = [
  "context",
  "bootstrap",
  "publish",
  "withdraw",
  "source",
  "trend",
  "run-start",
  "run-finish",
  "digest",
  "drain",
  "dashboard",
] as const;
export async function operate(
  db: Database,
  op: string,
  args: Record<string, unknown>,
  mail: MailConfig,
): Promise<unknown> {
  const now = new Date().toISOString();
  if (op === "context")
    return {
      instructions: "https://ag-ui.ai/automation.md",
      items: await articles(db, true),
      trends: await trendList(db),
      sources: (await db.prepare("SELECT * FROM sources").all()).results,
      freshness: await freshness(db),
      latestRuns: (
        await db
          .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT 12")
          .all()
      ).results,
    };
  if (op === "bootstrap") return seedDatabase(db);
  if (op === "publish") {
    const v = z
      .object({
        sourceRead: z.boolean(),
        dateConfirmed: z.boolean(),
        conflicts: z.array(z.string()).max(20),
      })
      .parse(args.verification);
    const input = z.record(z.string(), z.unknown()).parse(args.article);
    if (!v.sourceRead || !v.dateConfirmed || v.conflicts.length)
      input.status = "review";
    return upsertNews(
      db,
      input,
      z.string().min(8).max(1000).parse(args.reason),
      z.string().optional().parse(args.mergeInto),
    );
  }
  if (op === "withdraw") {
    const slug = z.string().parse(args.slug),
      old = (await articles(db, true)).find((x) => x.slug === slug);
    if (!old) throw new Error("Article not found");
    return upsertNews(
      db,
      { ...old, status: "withdrawn" },
      z.string().min(8).parse(args.reason),
    );
  }
  if (op === "source") {
    const s = z
      .object({
        id: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(100),
        url: z.string().url().refine(publicUrl),
        name: z.string().min(2).max(150),
        kind: z.enum([
          "official",
          "repository",
          "research",
          "discovery",
          "community",
        ]),
        success: z.boolean(),
        error: z.string().max(2000).optional(),
      })
      .parse(args);
    await db
      .prepare(
        "INSERT INTO sources(id,url,name,kind,checked_at,successful_at,error) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,name=excluded.name,kind=excluded.kind,checked_at=excluded.checked_at,successful_at=COALESCE(excluded.successful_at,sources.successful_at),error=excluded.error",
      )
      .bind(
        s.id,
        s.url,
        s.name,
        s.kind,
        now,
        s.success ? now : null,
        s.error || "Source unavailable",
      )
      .run();
    return { saved: s.id };
  }
  if (op === "trend") {
    const copy = z.object({
      title: z.string().min(5).max(160),
      summary: z.string().min(30).max(3000),
      limitation: z.string().min(20).max(2000),
    });
    const t = z
      .object({
        slug: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(120),
        items: z.array(z.string()).min(2).max(20),
        zh: copy,
        en: copy,
      })
      .parse(args) as Trend;
    const known = new Set((await articles(db)).map((x) => x.slug));
    if (t.items.some((s) => !known.has(s)))
      throw new Error("Trend evidence must link published events");
    t.updatedAt = now;
    await db
      .prepare(
        "INSERT INTO trends(slug,payload,updated_at) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
      )
      .bind(t.slug, JSON.stringify(t), now)
      .run();
    return { saved: t.slug };
  }
  if (op === "run-start") {
    const id = z.string().min(8).max(150).parse(args.id),
      kind = z.enum(["collection", "weekly", "verification"]).parse(args.kind);
    const old = await db
      .prepare("SELECT * FROM runs WHERE id=?")
      .bind(id)
      .first();
    if (old?.status === "succeeded")
      return { alreadyCompleted: true, run: old };
    await db
      .prepare(
        "INSERT INTO runs(id,kind,status,started_at) VALUES(?,?,'running',?) ON CONFLICT(id) DO UPDATE SET status='running'",
      )
      .bind(id, kind, now)
      .run();
    return { id, catchUpSince: (await freshness(db)).lastSuccess };
  }
  if (op === "run-finish") {
    const a = z
      .object({
        id: z.string(),
        status: z.enum(["succeeded", "failed"]),
        result: z.string().min(10).max(8000),
      })
      .parse(args);
    await db
      .prepare("UPDATE runs SET status=?,finished_at=?,result=? WHERE id=?")
      .bind(a.status, now, a.result, a.id)
      .run();
    await db
      .prepare("DELETE FROM rate_limits WHERE expires_at<?")
      .bind(Date.now())
      .run();
    return { id: a.id, ...(await freshness(db)) };
  }
  if (op === "digest") return queueDigest(db, z.string().parse(args.week));
  if (op === "drain") return drainQueue(db, mail);
  if (op === "dashboard")
    return {
      stats: await statsSummary(db, true),
      freshness: await freshness(db),
      email: {
        enabled: mailReady(mail),
        day: singaporeDay(),
        used: Number(
          (
            await db
              .prepare("SELECT count FROM mail_quota WHERE day=?")
              .bind(singaporeDay())
              .first()
          )?.count || 0,
        ),
        dailyLimit: 300,
        weeklyLimit: 250,
        deliveryStates: (
          await db
            .prepare(
              "SELECT status,count(*) AS count FROM deliveries GROUP BY status",
            )
            .all()
        ).results,
        subscribers: (
          await db
            .prepare(
              "SELECT status,count(*) AS count FROM subscribers GROUP BY status",
            )
            .all()
        ).results,
      },
      runs: (
        await db
          .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT 30")
          .all()
      ).results,
      sources: (await db.prepare("SELECT * FROM sources").all()).results,
      reviewQueue: (await articles(db, true)).filter(
        (x) => x.status !== "published",
      ),
      revisions: (
        await db
          .prepare(
            "SELECT slug,reason,created_at FROM revisions ORDER BY created_at DESC LIMIT 30",
          )
          .all()
      ).results,
      sourceCoverage: sourceDirectory.length,
    };
  throw new Error("Unknown operation");
}
