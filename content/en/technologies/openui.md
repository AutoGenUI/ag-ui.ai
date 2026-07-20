---
slug: openui
title: OpenUI
summary: A streaming-first Generative UI framework built around a compact language, React runtime, component libraries, prompt generation, and chat surfaces.
lastVerified: "2026-07-20"
order: 3
layer: declarative
kind: framework
maturity: active
sourceAuthority: primary
chooseWhen:
  - You want a React-oriented end-to-end framework with compact streamed UI output and ready-made component libraries.
  - Prompt generation and progressive rendering from an allowed component set should arrive as one integrated toolkit.
avoidWhen:
  - Your primary requirement is framework-neutral cross-platform interoperability rather than React runtime ergonomics.
composesWith:
  - ag-ui
  - copilotkit
license: MIT
primarySource: https://github.com/thesysdev/openui
officialSources:
  - https://github.com/thesysdev/openui
  - https://www.openui.com/
---

## What it solves

OpenUI combines OpenUI Lang, a streaming parser and renderer, component definitions, prompt generation, prebuilt libraries and chat interfaces. Its compact language is designed to reduce the tokens required to express a generated interface.

## Where it sits

OpenUI is a Generative UI framework. It can consume agent output carried by an interaction layer such as AG-UI, but does not replace the broader run lifecycle, state and tool event contract.

## Trade-off

The integrated path is productive for React teams, but adopting its language and runtime is a stronger framework commitment than adopting a transport-only protocol. Benchmark token claims against your own component catalog and model behavior.

## Security boundary

Keep the allowed component library narrow, validate Zod contracts, restrict actions and URLs, and never treat generated UI syntax as executable application code.

## Minimal example

```text
model stream → OpenUI Lang parser → registered component tree → React runtime
```

Begin with one display-only card and a strict component schema before introducing interactive actions.
