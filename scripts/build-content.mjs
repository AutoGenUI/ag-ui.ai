import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const projectRoot = path.resolve(import.meta.dirname, "..");
const locales = ["en", "zh"];
const collections = ["technologies", "learn", "updates"];

const commonSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(2),
  summary: z.string().min(20),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z.coerce.number().int().nonnegative(),
});

const technologySchema = commonSchema.extend({
  layer: z.enum(["interaction", "declarative", "embedded", "implementation"]),
  kind: z.enum(["protocol", "specification", "framework", "extension", "platform"]),
  maturity: z.enum(["stable", "active", "public-preview", "emerging"]),
  sourceAuthority: z.enum(["primary", "ecosystem"]),
  chooseWhen: z.array(z.string().min(8)).min(2),
  avoidWhen: z.array(z.string().min(8)).min(1),
  composesWith: z.array(z.string().regex(/^[a-z0-9-]+$/)),
  license: z.string().min(2),
  primarySource: z.string().url(),
  officialSources: z.array(z.string().url()).min(1),
});

const learningSchema = commonSchema.extend({
  duration: z.string().min(2),
  level: z.enum(["foundation", "intermediate", "advanced"]),
});

const updateSchema = commonSchema.extend({
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const schemas = { technologies: technologySchema, learn: learningSchema, updates: updateSchema };

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readCollection(locale, collection) {
  const directory = path.join(projectRoot, "content", locale, collection);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  const entries = [];

  for (const file of files) {
    const source = await readFile(path.join(directory, file), "utf8");
    const parsed = matter(source);
    const data = schemas[collection].parse(parsed.data);
    const fileSlug = file.replace(/\.md$/, "");
    if (data.slug !== fileSlug) throw new Error(`${locale}/${collection}/${file}: slug must match filename`);
    if (!parsed.content.trim()) throw new Error(`${locale}/${collection}/${file}: body is empty`);
    const proseWithoutCodeFences = parsed.content.replace(/```[\s\S]*?```/g, "");
    if (/<\/?[a-z][^>]*>/i.test(proseWithoutCodeFences)) throw new Error(`${locale}/${collection}/${file}: raw HTML is not allowed`);
    if (collection === "technologies") {
      const minimalHeading = locale === "zh" ? /^## 最小示例$/m : /^## Minimal example$/m;
      const securityHeading = locale === "zh" ? /^## (安全边界|安全采用路径)$/m : /^## (Security boundary|Safe adoption path)$/m;
      if (!minimalHeading.test(parsed.content)) throw new Error(`${locale}/${collection}/${file}: minimal example section is required`);
      if (!securityHeading.test(parsed.content)) throw new Error(`${locale}/${collection}/${file}: security boundary section is required`);
    }
    entries.push({ ...data, body: parsed.content.trim() });
  }

  return entries.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

function assertParity(bundle, collection) {
  const english = bundle[collection].en.map((item) => item.slug).sort();
  const chinese = bundle[collection].zh.map((item) => item.slug).sort();
  if (JSON.stringify(english) !== JSON.stringify(chinese)) {
    throw new Error(`${collection}: /en and /zh slugs must stay in parity`);
  }
}

const bundle = Object.fromEntries(collections.map((collection) => [collection, {}]));
for (const collection of collections) {
  for (const locale of locales) bundle[collection][locale] = await readCollection(locale, collection);
  assertParity(bundle, collection);
}

const technologySlugs = new Set(bundle.technologies.en.map((item) => item.slug));
for (const locale of locales) {
  for (const item of bundle.technologies[locale]) {
    for (const dependency of item.composesWith) {
      if (!technologySlugs.has(dependency) && !["a2a", "mcp"].includes(dependency)) {
        throw new Error(`${locale}/technologies/${item.slug}: unknown composesWith value ${dependency}`);
      }
    }
  }
}

const chineseBySlug = Object.fromEntries(bundle.technologies.zh.map((item) => [item.slug, item]));
const generatedAt = new Date().toISOString();
const catalog = {
  schemaVersion: 1,
  generatedAt,
  items: bundle.technologies.en.map((english) => {
    const chinese = chineseBySlug[english.slug];
    return {
      slug: english.slug,
      name: { en: english.title, zh: chinese.title },
      summary: { en: english.summary, zh: chinese.summary },
      layer: english.layer,
      kind: english.kind,
      maturity: english.maturity,
      sourceAuthority: english.sourceAuthority,
      chooseWhen: { en: english.chooseWhen, zh: chinese.chooseWhen },
      avoidWhen: { en: english.avoidWhen, zh: chinese.avoidWhen },
      composesWith: english.composesWith,
      license: english.license,
      primarySource: english.primarySource,
      officialSources: english.officialSources,
      lastVerified: english.lastVerified,
    };
  }),
};

const searchIndex = [];
for (const collection of collections) {
  for (const locale of locales) {
    for (const item of bundle[collection][locale]) {
      searchIndex.push({
        id: `${locale}:${collection}:${item.slug}`,
        locale,
        type: collection,
        title: item.title,
        summary: item.summary,
        text: stripMarkdown(item.body),
        href:
          collection === "technologies"
            ? `/${locale}/technologies/${item.slug}`
            : collection === "learn"
              ? `/${locale}/learn/${item.slug}`
              : `/${locale}/updates#${item.slug}`,
      });
    }
  }
}

const updateItems = locales.flatMap((locale) => bundle.updates[locale].map((item) => ({ ...item, locale })));
const rssItems = updateItems
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .map(
    (item) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>https://ag-ui.ai/${item.locale}/updates#${item.slug}</link>
      <guid>https://ag-ui.ai/${item.locale}/updates#${item.slug}</guid>
      <pubDate>${new Date(`${item.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>
      <description><![CDATA[${item.summary}]]></description>
      <language>${item.locale === "zh" ? "zh-CN" : "en"}</language>
    </item>`,
  )
  .join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>AG-UI.AI — Generative UI Atlas</title>
    <link>https://ag-ui.ai/</link>
    <description>An independent, source-verified guide to the Generative UI ecosystem.</description>
    <language>en</language>
${rssItems}
  </channel>
</rss>
`;

await mkdir(path.join(projectRoot, "generated"), { recursive: true });
await mkdir(path.join(projectRoot, "public"), { recursive: true });
await Promise.all([
  writeFile(path.join(projectRoot, "generated", "content.json"), `${JSON.stringify(bundle, null, 2)}\n`),
  writeFile(path.join(projectRoot, "public", "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`),
  writeFile(path.join(projectRoot, "public", "search-index.json"), `${JSON.stringify(searchIndex, null, 2)}\n`),
  writeFile(path.join(projectRoot, "public", "legacy-feed.xml"), rss),
]);

const documentCount = Object.values(bundle).reduce(
  (total, collection) => total + locales.reduce((count, locale) => count + collection[locale].length, 0),
  0,
);
console.log(`Validated ${documentCount} bilingual content documents.`);
