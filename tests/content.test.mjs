import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("content stays bilingual and slug-aligned", async () => {
  const bundle = JSON.parse(await readFile(new URL("generated/content.json", root), "utf8"));
  for (const collection of ["technologies", "learn", "updates"]) {
    assert.deepEqual(bundle[collection].en.map((item) => item.slug).sort(), bundle[collection].zh.map((item) => item.slug).sort());
  }
  assert.equal(bundle.technologies.en.length, 7);
  assert.equal(bundle.learn.en.length, 4);
});

test("catalog exposes the public schema and source authority", async () => {
  const catalog = JSON.parse(await readFile(new URL("public/catalog.json", root), "utf8"));
  assert.equal(catalog.schemaVersion, 1);
  assert.match(catalog.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(catalog.items.length, 7);
  for (const item of catalog.items) {
    assert.ok(item.name.en && item.name.zh);
    assert.ok(item.summary.en && item.summary.zh);
    assert.ok(item.primarySource.startsWith("https://"));
    assert.match(item.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(catalog.items.find((item) => item.slug === "open-json-ui").sourceAuthority, "ecosystem");
});

test("RSS and search index include both locales", async () => {
  const [rss, search] = await Promise.all([readFile(new URL("public/legacy-feed.xml", root), "utf8"), readFile(new URL("public/search-index.json", root), "utf8").then(JSON.parse)]);
  assert.match(rss, /<rss version="2\.0">/);
  assert.ok(search.some((item) => item.locale === "en" && item.type === "technologies"));
  assert.ok(search.some((item) => item.locale === "zh" && item.type === "learn"));
});
