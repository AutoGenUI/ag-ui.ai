---
slug: a2ui
title: A2UI
summary: A declarative, portable UI format that lets agents describe updatable interfaces rendered through trusted client-side component catalogs.
lastVerified: "2026-07-20"
order: 2
layer: declarative
kind: specification
maturity: public-preview
sourceAuthority: primary
chooseWhen:
  - The same agent-generated UI intent must render across web, Flutter, or other native clients.
  - You want declarative data, incremental updates, and a client-controlled trusted component catalog.
avoidWhen:
  - You need a stable version-one wire contract today or only target one tightly controlled React application.
composesWith:
  - ag-ui
  - copilotkit
  - a2a
license: Apache-2.0
primarySource: https://github.com/a2ui-project/a2ui
officialSources:
  - https://github.com/a2ui-project/a2ui
  - https://a2ui.org/
---

## What it solves

A2UI lets an agent “speak UI” as declarative data. The client maps abstract components onto its own trusted widgets, keeping styling, accessibility and execution under application control.

## Where it sits

A2UI is the payload and rendering contract. It does not replace an agent-to-client transport: its own documentation lists AG-UI and A2A as compatible transports. This separation is especially useful when one agent surface must appear across web and native clients.

## Maturity note

The project currently identifies its stable protocol family as a public preview while a version-one specification is being prepared. Pin the protocol version and isolate renderer adapters so upgrades do not leak through the application.

## Security boundary

Only register reviewed components and actions. Reject unknown component types, validate bindings, constrain URLs and rich text, and keep high-impact actions behind explicit user confirmation and server authorization.

## Minimal example

The exact envelope is version-specific, but the responsibility split is stable:

```text
agent → declarative component tree + data bindings
client catalog → validates types and props → native trusted widgets
```

Pin the A2UI version before turning this conceptual flow into production JSON.
