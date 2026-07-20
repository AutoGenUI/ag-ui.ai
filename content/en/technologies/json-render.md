---
slug: json-render
title: json-render
summary: A Generative UI framework where models produce predictable JSON specifications constrained by developer-defined components and actions.
lastVerified: "2026-07-20"
order: 4
layer: declarative
kind: framework
maturity: active
sourceAuthority: primary
chooseWhen:
  - You already think in component catalogs and want schema-constrained JSON with progressive rendering.
  - You need one catalog model across several web frameworks, native surfaces, documents, email, video, or terminal UI.
avoidWhen:
  - You need an agent run transport or prefer a compact non-JSON language optimized for minimal token use.
composesWith:
  - ag-ui
  - mcp-apps
license: Apache-2.0
primarySource: https://github.com/vercel-labs/json-render
officialSources:
  - https://github.com/vercel-labs/json-render
  - https://json-render.dev/
---

## What it solves

json-render gives developers a catalog, schema and renderer contract so AI output stays inside known components and actions. Its ecosystem spans React, Vue, Svelte, Solid, React Native and non-screen outputs such as PDF and email.

## Where it sits

It is a UI specification and rendering framework, not an agent interaction protocol. Combine it with AG-UI when you also need run lifecycle, streaming messages, tools and shared state.

## Trade-off

JSON is familiar, inspectable and tool-friendly, but verbose structures can cost more tokens than specialized languages. A broad catalog also increases prompt size and the number of states that must be tested.

## Security boundary

Generated specifications must never select arbitrary imports or execute arbitrary code. Validate every node, action and binding against the registered catalog and perform authorization outside the renderer.

## Minimal example

```json
{
  "type": "MetricCard",
  "props": { "label": "Active runs", "value": 12 }
}
```

The renderer accepts this only when `MetricCard`, `label`, and `value` are declared in the local catalog; unknown fields fail closed.
