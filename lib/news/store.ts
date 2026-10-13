import seedJson from "./seed.json";
import type { Database, NewsItem, Trend } from "./types";
import { canonicalUrl, newsSchema, sha } from "./core";
export const seed = seedJson as NewsItem[];
export const sourceDirectory = [
  ["openai", "OpenAI", "https://openai.com/news/", "official"],
  ["openui", "OpenUI / Thesys", "https://www.openui.com/blog", "official"],
  [
    "google",
    "Google Developers",
    "https://developers.googleblog.com/",
    "official",
  ],
  [
    "gemini",
    "Google Gemini",
    "https://blog.google/products-and-platforms/products/gemini/",
    "official",
  ],
  [
    "mcp",
    "Model Context Protocol",
    "https://blog.modelcontextprotocol.io/",
    "official",
  ],
  ["copilotkit", "CopilotKit", "https://www.copilotkit.ai/blog", "official"],
  [
    "ag-ui",
    "AG-UI releases",
    "https://github.com/ag-ui-protocol/ag-ui/releases",
    "repository",
  ],
  [
    "json-render",
    "json-render releases",
    "https://github.com/vercel-labs/json-render/releases",
    "repository",
  ],
  [
    "a2ui",
    "Google A2UI",
    "https://github.com/google/A2UI/releases",
    "repository",
  ],
  [
    "flutter",
    "Flutter GenUI",
    "https://github.com/flutter/genui/releases",
    "repository",
  ],
  [
    "ai-sdk",
    "Vercel AI SDK",
    "https://github.com/vercel/ai/releases",
    "repository",
  ],
  ["anthropic", "Anthropic", "https://www.anthropic.com/news", "official"],
  ["arxiv-hci", "arXiv HCI", "https://arxiv.org/list/cs.HC/recent", "research"],
  [
    "huggingface",
    "Hugging Face papers",
    "https://huggingface.co/papers",
    "discovery",
  ],
  [
    "mcp-apps",
    "MCP Apps specification",
    "https://github.com/modelcontextprotocol/ext-apps",
    "repository",
  ],
].map(([id, name, url, kind]) => ({ id, name, url, kind }));

export function defaultTrends(items: NewsItem[]): Trend[] {
  const sets = [
    {
      slug: "interfaces-enter-everyday-products",
      categories: ["product", "case-study"],
      zh: {
        title: "界面成为回答的一部分",
        summary:
          "从 Gemini 的动态视图到 ChatGPT Intelligent UI，信息布局与交互选择进入面向大众的对话体验。关注用户能完成什么，而不仅是生成了什么。",
        limitation:
          "Design Theater 研究中解释与实现的落差提醒我们：能生成界面不等于设计意图得到落实。产品公告也不等于所有地区已开放。",
      },
      en: {
        title: "The interface becomes part of the answer",
        summary:
          "Dynamic views and Intelligent UI bring layout and interaction into everyday conversations. The important question is what people can accomplish, not just what gets generated.",
        limitation:
          "The rationale–implementation gap in Design Theater cautions that generating a screen does not establish design fidelity. Announcements also do not establish availability in every region.",
      },
    },
    {
      slug: "protocols-and-native-surfaces",
      categories: ["protocol", "framework"],
      zh: {
        title: "协议与渲染正在解耦",
        summary:
          "事件传输、界面描述、宿主嵌入与组件运行时逐渐形成可组合的层次。标准化与框架集成一起扩展了界面的落点。",
        limitation:
          "React Native 公告中的 A2UI 仍是后续方向；集成不等于语义完全互通。版本、权限、组件能力和宿主限制仍影响可移植性。",
      },
      en: {
        title: "Transport and rendering are separating",
        summary:
          "Agent events, interface descriptions, embedded hosts and component runtimes are forming composable layers. Specifications and integrations expand where interfaces can live.",
        limitation:
          "A2UI in the React Native announcement is still a future direction. Integration is not full semantic interoperability; versions, permissions and host capabilities constrain portability.",
      },
    },
    {
      slug: "specialized-models-and-local-runtime",
      categories: ["model"],
      zh: {
        title: "专用模型与本地交互",
        summary:
          "专用训练尝试让界面生成更可靠；运行时接管重复交互，减少每次操作都重新推理的需要。端侧可用性值得持续验证。",
        limitation:
          "参数更少不自动意味着整体成本更低。硬件、精度、延迟与正确性需要在一致的条件下测量。",
      },
      en: {
        title: "Specialized models, local interactions",
        summary:
          "Specialized training targets reliable generation while runtimes handle repeat interactions without another full inference. Local deployment remains a direction to test.",
        limitation:
          "Fewer active parameters do not establish lower total cost. Hardware, precision, latency and correctness need comparable measurements.",
      },
    },
    {
      slug: "beyond-the-first-screenshot",
      categories: ["research"],
      zh: {
        title: "评测走出第一张截图",
        summary:
          "从可解析、可渲染到连续修改、设计一致性和真实任务完成，研究正在拓宽生成式 UI 的验收标准。",
        limitation:
          "不同评测的任务、组件目录与样本不一致，分数不能直接拼成统一排行榜；本站未独立复现实验。",
      },
      en: {
        title: "Beyond the first screenshot",
        summary:
          "Evaluation is expanding from valid syntax and visible screens to repeated edits, design intent and actual task completion.",
        limitation:
          "Different tasks and component catalogs prevent a universal leaderboard. Reported experiments have not been independently reproduced by this site.",
      },
    },
  ];
  return sets.map((s) => ({
    slug: s.slug,
    zh: s.zh,
    en: s.en,
    items: items
      .filter(
        (x) => (s.categories.includes(x.category) || (s.slug === "specialized-models-and-local-runtime" && x.slug === "openui-reactive-query-runtime") || (s.slug === "interfaces-enter-everyday-products" && x.slug === "design-theater-rationale-implementation-gap")) && x.status === "published",
      )
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
      .slice(0, 7)
      .map((x) => x.slug),
    updatedAt: "2026-10-10",
  }));
}
export async function articles(
  db?: Database,
  includeUnpublished = false,
): Promise<NewsItem[]> {
  let all: NewsItem[] = seed;
  if (db) {
    const rows = await db
      .prepare("SELECT payload FROM news")
      .all<{ payload: string }>();
    all = rows.results.map((r) => JSON.parse(r.payload));
  }
  return all
    .filter((x) => includeUnpublished || x.status === "published")
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) || a.slug.localeCompare(b.slug),
    );
}
export async function trendList(db?: Database): Promise<Trend[]> {
  if (db) {
    const r = await db
      .prepare("SELECT payload FROM trends")
      .all<{ payload: string }>();
    if (r.results.length) return r.results.map((x) => JSON.parse(x.payload));
  }
  return defaultTrends(await articles(db));
}
export async function upsertNews(
  db: Database,
  input: unknown,
  reason: string,
  mergeInto?: string,
) {
  let item = newsSchema.parse(input);
  const url = canonicalUrl(item.canonicalUrl);
  const previous = await db
    .prepare(
      "SELECT payload,hash FROM news WHERE slug=? OR canonical_url=? LIMIT 1",
    )
    .bind(mergeInto || item.slug, url)
    .first<{ payload: string; hash: string }>();
  if (mergeInto && !previous) throw new Error("Merge target not found");
  if (previous) {
    const old: NewsItem = JSON.parse(previous.payload);
    item = {
      ...item,
      slug: old.slug,
      indexedAt: old.indexedAt,
      canonicalUrl: old.canonicalUrl,
      sources: [
        ...new Map(
          [
            ...(old.sources || []),
            ...(item.sources || []),
            ...(url !== old.canonicalUrl
              ? [{ url, label: item.sourceName }]
              : []),
          ].map((x) => [x.url, x]),
        ).values(),
      ],
    };
  } else
    item = { ...item, canonicalUrl: url, indexedAt: new Date().toISOString() };
  item = {
    ...item,
    sources: [
      ...new Map(
        (item.sources || []).map((s) => [
          canonicalUrl(s.url),
          { ...s, url: canonicalUrl(s.url) },
        ]),
      ).values(),
    ].sort((a, b) => a.url.localeCompare(b.url)),
  };
  const payload = JSON.stringify(item),
    hash = await sha(payload);
  if (previous?.hash === hash) return { slug: item.slug, changed: false };
  const now = new Date().toISOString();
  if (!reason.trim())
    throw new Error("A publication or revision reason is required");
  await db.batch([
    db
      .prepare(
        "INSERT INTO revisions(id,slug,hash,payload,reason,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        item.slug,
        hash,
        payload,
        reason.slice(0, 1000),
        now,
      ),
    db
      .prepare(
        "INSERT INTO news(slug,canonical_url,status,event_date,project,category,payload,hash,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET status=excluded.status,event_date=excluded.event_date,project=excluded.project,category=excluded.category,payload=excluded.payload,hash=excluded.hash,updated_at=excluded.updated_at",
      )
      .bind(
        item.slug,
        item.canonicalUrl,
        item.status,
        item.eventDate,
        item.project,
        item.category,
        payload,
        hash,
        now,
      ),
  ]);
  return { slug: item.slug, changed: true };
}
export async function seedDatabase(db: Database) {
  let inserted = 0;
  for (const raw of seed) {
    const item = {
      ...newsSchema.parse(raw),
      canonicalUrl: canonicalUrl(raw.canonicalUrl),
      sources: [...(raw.sources || [])].sort((a, b) =>
        a.url.localeCompare(b.url),
      ),
    };
    const payload = JSON.stringify(item),
      hash = await sha(payload);
    const r = await db
      .prepare(
        "INSERT OR IGNORE INTO news(slug,canonical_url,status,event_date,project,category,payload,hash,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        item.slug,
        item.canonicalUrl,
        item.status,
        item.eventDate,
        item.project,
        item.category,
        payload,
        hash,
        item.indexedAt,
      )
      .run();
    inserted += r.meta.changes;
    await db
      .prepare(
        "INSERT OR IGNORE INTO revisions(id,slug,hash,payload,reason,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM news WHERE slug=? AND hash=?)",
      )
      .bind(
        `seed:${item.slug}`,
        item.slug,
        hash,
        payload,
        "Initial source-verified editorial collection",
        item.indexedAt,
        item.slug,
        hash,
      )
      .run();
  }
  for (const s of sourceDirectory)
    await db
      .prepare(
        "INSERT OR IGNORE INTO sources(id,url,name,kind) VALUES(?,?,?,?)",
      )
      .bind(s.id, s.url, s.name, s.kind)
      .run();
  for (const t of defaultTrends(seed))
    await db
      .prepare(
        "INSERT OR IGNORE INTO trends(slug,payload,updated_at) VALUES(?,?,?)",
      )
      .bind(t.slug, JSON.stringify(t), t.updatedAt)
      .run();
  return { inserted, total: (await articles(db)).length };
}
export async function rateLimit(
  db: Database,
  key: string,
  limit: number,
  windowMs = 3600000,
  now = Date.now(),
): Promise<boolean> {
  const bucket = Math.floor(now / windowMs);
  const result = await db
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
    )
    .bind(`${key}:${bucket}`, now + windowMs, limit)
    .first();
  return !!result;
}
export async function freshness(db?: Database) {
  if (!db) return { lastSuccess: null, stale: true };
  const r = await db
    .prepare(
      "SELECT finished_at FROM runs WHERE kind='collection' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1",
    )
    .first<{ finished_at: string }>();
  return {
    lastSuccess: r?.finished_at ?? null,
    stale: !r || Date.now() - Date.parse(r.finished_at) > 36 * 3600000,
  };
}
