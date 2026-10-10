import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Newsroom uses managed D1 and MCP without third-party analytics", async () => {
  const [hosting, packageJson, layout] = await Promise.all([read(".openai/hosting.json"), read("package.json"), read("app/layout.tsx")]);
  const hostingConfig = JSON.parse(hosting);
  assert.deepEqual(Object.keys(hostingConfig).sort(), ["capabilities", "d1", "project_id", "r2"]);
  assert.match(hostingConfig.project_id, /^appgprj_[a-z0-9]+$/);
  assert.equal(hostingConfig.d1, "DB");
  assert.deepEqual(hostingConfig.capabilities, ["mcp"]);
  assert.equal(hostingConfig.r2, null);
  assert.doesNotMatch(packageJson, /auth0|clerk|supabase|segment|posthog/i);
  assert.match(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com|google-analytics|gtag/i);
});

test("model credentials stay request-scoped and the trial is explicitly gated", async () => {
  const [settings, provider, route] = await Promise.all([
    read("components/academy/model-settings.tsx"),
    read("lib/academy/provider.ts"),
    read("app/api/agent/route.ts"),
  ]);
  assert.doesNotMatch(settings, /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)|document\.cookie/);
  assert.match(settings, /type="password"/);
  assert.match(provider, /TRIAL_ENABLED\s*!==\s*"true"/);
  assert.match(provider, /CUSTOM_PROVIDER_HOSTS/);
  assert.doesNotMatch(route, /console\.(log|error)|error\.stack/);
});

test("Markdown renderer does not enable raw HTML", async () => {
  const renderer = await read("components/markdown-article.tsx");
  assert.match(renderer, /ReactMarkdown/);
  assert.doesNotMatch(renderer, /rehypeRaw|dangerouslySetInnerHTML/);
});

test("global accessibility policies include visible focus, skip navigation and reduced motion", async () => {
  const [css, shell] = await Promise.all([read("app/globals.css"), read("components/site-shell.tsx")]);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(shell, /className="skip-link"/);
  assert.match(shell, /<main id="main">/);
});

function relativeLuminance(hex) {
  const channels = hex.match(/\w\w/g).map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("small-text color pairs meet the WCAG AA 4.5:1 threshold", async () => {
  const css = await read("app/globals.css");
  const pairs = [
    ["#111318", "#f5f2ea"],
    ["#62656d", "#f5f2ea"],
    ["#2457f5", "#f5f2ea"],
    ["#ffffff", "#2457f5"],
    ["#ffffff", "#7752e7"],
    ["#111318", "#e76650"],
    ["#111318", "#2c956c"],
    ["#7e8697", "#10131a"],
    ["#81899a", "#10131a"],
  ];
  for (const [foreground, background] of pairs) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  assert.match(css, /layer-pill\.embedded \{ color: var\(--ink\)/);
  assert.match(css, /layer-pill\.implementation \{ color: var\(--ink\)/);
});
