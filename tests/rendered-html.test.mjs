import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/en") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://ag-ui.ai${pathname}`, { headers: { accept: "text/html", host: "ag-ui.ai" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("root redirects to the English atlas", async () => {
  const response = await render("/");
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/en");
});

test("server-renders both localized home pages with semantic content", async () => {
  for (const [locale, heading] of [["en", "Choose the right layer"], ["zh", "看懂生成式 UI 技术栈"]]) {
    const response = await render(`/${locale}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, new RegExp(heading));
    assert.match(html, /Generative UI Atlas/);
    assert.match(html, /href="\/en"/);
    assert.match(html, /href="\/zh"/);
    assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/);
  }
});

test("core homepage guidance remains present without executing JavaScript", async () => {
  const response = await render("/en");
  const htmlWithoutScripts = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.match(htmlWithoutScripts, /Choose the right layer for your Generative UI stack/);
  assert.match(htmlWithoutScripts, /One ecosystem\. Four architectural questions/);
  assert.match(htmlWithoutScripts, /href="\/en\/technologies\/ag-ui"/);
  assert.match(htmlWithoutScripts, /Compose a stack, not a winner/);
});

test("technology pages expose canonical, hreflang and structured data", async () => {
  const response = await render("/en/technologies/ag-ui");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /rel="canonical"[^>]+href="https:\/\/ag-ui\.ai\/en\/technologies\/ag-ui"/);
  assert.match(html, /hrefLang="en"|hreflang="en"/i);
  assert.match(html, /TechArticle/);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /Last verified/);
});

test("lab and comparison routes contain their complete no-key experiences", async () => {
  const [lab, compare] = await Promise.all([render("/en/lab/ag-ui-events"), render("/en/compare")]);
  assert.equal(lab.status, 200);
  assert.equal(compare.status, 200);
  assert.match(await lab.text(), /EVENT STREAM/);
  assert.match(await compare.text(), /Comparison matrix/);
});

test("unknown routes use the site 404", async () => {
  const response = await render("/en/not-a-real-route");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /outside the atlas/);
});

test("www host permanently redirects without losing path or query", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-www`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("https://www.ag-ui.ai/zh/map?source=test"), {}, {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://ag-ui.ai/zh/map?source=test");
});
