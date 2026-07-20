import assert from "node:assert/strict";
import test from "node:test";
import { recommendStack } from "../lib/decision.ts";

test("host surfaces recommend MCP Apps", () => {
  const [primary] = recommendStack({ surface: "chat-host", control: "strict", streaming: true, hasCatalog: true }, "en");
  assert.deepEqual(primary.technologies, ["mcp-apps"]);
});

test("cross-platform surfaces compose A2UI with AG-UI", () => {
  const [primary] = recommendStack({ surface: "cross-platform", control: "balanced", streaming: false, hasCatalog: false }, "en");
  assert.deepEqual(primary.technologies, ["a2ui", "ag-ui"]);
  assert.match(primary.caveat, /public preview/i);
});

test("strict first-party surfaces keep rendering under product control", () => {
  const [primary] = recommendStack({ surface: "own-app", control: "strict", streaming: true, hasCatalog: false }, "zh");
  assert.deepEqual(primary.technologies, ["ag-ui", "copilotkit"]);
});

test("trusted catalogs select json-render without suppressing alternatives", () => {
  const results = recommendStack({ surface: "own-app", control: "balanced", streaming: true, hasCatalog: true }, "en");
  assert.deepEqual(results[0].technologies, ["json-render", "ag-ui"]);
  assert.equal(results.length, 2);
});
