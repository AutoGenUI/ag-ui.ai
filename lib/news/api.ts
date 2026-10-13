import { z } from "zod";
import { readyDatabase } from "./data";
import {
  database,
  isOwner,
  json,
  originAllowed,
  readBody,
  setting,
} from "./runtime";
import { articles, freshness, sourceDirectory, trendList } from "./store";
import { recordMetric, statsSummary } from "./analytics";
import { equalSecret, escapeHtml, hmac } from "./core";
import {
  mailReady,
  mailCapacity,
  mailWebhook,
  manageSubscription,
  subscribe,
  type MailConfig,
} from "./mail";
import { operate, operations } from "./operations";
export function mailConfig(): MailConfig {
  return {
    enabled:
      setting("EMAIL_ENABLED") === "true" &&
      setting("BREVO_DOMAIN_VERIFIED") === "true" &&
      setting("EMAIL_ACCEPTANCE_PASSED") === "true",
    apiKey: setting("BREVO_API_KEY"),
    sender: setting("BREVO_SENDER_EMAIL"),
    secret: setting("SUBSCRIPTION_SECRET"),
    webhookSecret: setting("BREVO_WEBHOOK_SECRET"),
    domainVerified: setting("BREVO_DOMAIN_VERIFIED") === "true",
    testRecipient: setting("EMAIL_TEST_RECIPIENT"),
  };
}
const toolList = [
  {
    name: "newsroom_read",
    description:
      "Owner: read editorial context, source registry, catch-up progress and operating instructions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "newsroom_write",
    description:
      "Owner: maintain verified bilingual news and trends, source discovery/check status, run checkpoints and weekly delivery queue. Read https://ag-ui.ai/automation.md for the operation contract. Publish requires article, reason and verification {sourceRead,dateConfirmed,conflicts}; mergeInto folds multiple sources into one event. mail-test is only for explicitly authorized owner acceptance: {action:status|restart|confirmation|weekly,runId?:stable-id,locale?:zh|en,topics?:categories}; sending always uses the server-configured recipient and rejects address arguments. restart sends no mail and requires public email disabled, an unsubscribed test recipient, no uncertain submission, and a new runId. Explicit owner-authorized {action:release,expectedRecipient:email} sends no mail, requires an exact normalized match to EMAIL_TEST_RECIPIENT, releases only its existing test role into public unsubscribed state with rotated signed links, and preserves test delivery history and quota. Suppression or unresolved submission blocks release; ordinary public signup and new mailbox confirmation are still required. release is idempotent for an existing public role and cannot change sending targets. Never use mail-test in scheduled editorial tasks.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: operations.filter((x) => x !== "context"),
        },
        arguments: { type: "object" },
      },
      required: ["operation", "arguments"],
      additionalProperties: false,
    },
  },
];
async function mcp(request: Request) {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  const msg = (await readBody(request, 128000)) as {
    id?: unknown;
    method?: string;
    params?: { name?: string; arguments?: Record<string, unknown> };
  };
  const id = msg.id ?? null;
  if (msg.method === "server/discover")
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {} },
      },
    });
  if (msg.method === "initialize")
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2026-07-28",
        capabilities: { tools: {} },
        serverInfo: { name: "AG-UI.AI newsroom", version: "1.0.0" },
      },
    });
  if (msg.method === "notifications/initialized")
    return new Response(null, { status: 202 });
  if (!isOwner(request.headers))
    return json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: "Site owner authentication required" },
      },
      403,
    );
  if (msg.method === "tools/list")
    return json({ jsonrpc: "2.0", id, result: { tools: toolList } });
  if (msg.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (msg.method !== "tools/call")
    return json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    });
  try {
    const p = msg.params;
    if (!p || !["newsroom_read", "newsroom_write"].includes(p.name || ""))
      throw new Error("Unknown tool");
    const a = p.arguments || {};
    const result = await operate(
      database(),
      p.name === "newsroom_read"
        ? "context"
        : z.enum(operations).parse(a.operation),
      p.name === "newsroom_read"
        ? {}
        : z.record(z.string(), z.unknown()).parse(a.arguments),
      mailConfig(),
    );
    return json({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: JSON.stringify(result) }] },
    });
  } catch (error) {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text:
              error instanceof z.ZodError
                ? "Input validation failed: " + JSON.stringify(error.issues)
                : error instanceof Error
                  ? error.message
                  : "Operation failed",
          },
        ],
      },
    });
  }
}
export async function newsApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (
    path !== "/mcp" &&
    !path.startsWith("/api/news") &&
    !path.startsWith("/api/stats") &&
    !path.startsWith("/api/subscription") &&
    !path.startsWith("/api/admin") &&
    !path.startsWith("/api/brevo") &&
    !/^\/(en\/|zh\/)?feed\.xml$/.test(path)
  )
    return null;
  try {
    if (path === "/mcp") return await mcp(request);
    if (request.method === "GET" && /^\/(en\/|zh\/)?feed\.xml$/.test(path)) {
      const locale = path.startsWith("/zh/") ? "zh" : "en";
      let db;
      try {
        db = await readyDatabase();
      } catch {}
      const items = await articles(db);
      const esc = escapeHtml;
      const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AG-UI.AI — Generative UI</title><link>https://ag-ui.ai/${locale}</link><description>Independent, source-linked Generative UI news</description><language>${locale}</language>${items
        .slice(0, 100)
        .map(
          (x) =>
            `<item><guid isPermaLink="false">${esc(x.slug)}</guid><title>${esc(x[locale].title)}</title><link>https://ag-ui.ai/${locale}/news/${x.slug}</link><description>${esc(x[locale].summary + " " + (locale === "zh" ? "事件日期：" : "Event date: ") + x.eventDate)}</description><pubDate>${new Date(x.indexedAt).toUTCString()}</pubDate><source url="${esc(x.canonicalUrl)}">${esc(x.sourceName)}</source></item>`,
        )
        .join("")}</channel></rss>`;
      return new Response(rss, {
        headers: {
          "content-type": "application/rss+xml; charset=utf-8",
          "cache-control": "public,max-age=300",
        },
      });
    }
    if (path === "/api/subscription/status" && request.method === "GET")
      return json(await mailCapacity(database(), mailConfig()));
    if (path === "/api/news" && request.method === "GET") {
      const db = await readyDatabase();
      return json({
        items: await articles(db),
        trends: await trendList(db),
        sources: sourceDirectory,
        freshness: await freshness(db),
      });
    }
    if (path === "/api/stats" && request.method === "GET")
      return json(await statsSummary(database()), 200, {
        "cache-control": "public,max-age=30",
      });
    if (path.startsWith("/api/admin")) {
      if (!isOwner(request.headers))
        return json({ error: "Owner authentication required" }, 403);
      if (request.method === "GET")
        return json(await operate(database(), "dashboard", {}, mailConfig()));
      if (request.method !== "POST" || !originAllowed(request))
        return json({ error: "Same-origin POST required" }, 403);
      const body = z
        .object({
          operation: z.enum(operations),
          arguments: z.record(z.string(), z.unknown()),
        })
        .parse(await readBody(request, 128000));
      return json(
        await operate(database(), body.operation, body.arguments, mailConfig()),
      );
    }
    if (path === "/api/brevo/webhook" && request.method === "POST") {
      if (
        !equalSecret(
          request.headers.get("authorization") || "",
          `Bearer ${setting("BREVO_WEBHOOK_SECRET")}`,
        ) ||
        !setting("BREVO_WEBHOOK_SECRET")
      )
        return json({ error: "Unauthorized" }, 401);
      return json(await mailWebhook(database(), await readBody(request)));
    }
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    if (!originAllowed(request))
      return json({ error: "Same-origin POST required" }, 403);
    if (path === "/api/stats")
      return json(
        await recordMetric(
          database(),
          request,
          await readBody(request, 3000),
          setting("ANALYTICS_SECRET"),
        ),
      );
    if (path === "/api/subscription") {
      if (!mailReady(mailConfig()))
        return json({ status: "pending-activation" }, 503);
      const key = await hmac(
        request.headers.get("cf-connecting-ip") || "unknown",
        setting("SUBSCRIPTION_SECRET"),
      );
      const result = await subscribe(
          database(),
          await readBody(request, 3000),
          mailConfig(),
          key,
        );
      return json(result, result.status === "capacity-full" ? 409 : 200);
    }
    if (path === "/api/subscription/manage") {
      const result = await manageSubscription(
          database(),
          (await readBody(request, 3000)) as Record<string, unknown>,
          mailConfig(),
        );
      return json(result, ["capacity-full", "preferences-not-saved", "confirmation-unavailable"].includes(result.status) ? 409 : 200);
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid input"
            : error instanceof Error && /link|expired/.test(error.message)
              ? error.message
              : "Service unavailable",
      },
      error instanceof z.ZodError ? 400 : 503,
    );
  }
}
