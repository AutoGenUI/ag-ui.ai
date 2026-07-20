---
slug: ag-ui
title: AG-UI
summary: An event-based protocol for connecting agent runtimes to user-facing applications with streaming, state, tools, and human interaction.
lastVerified: "2026-07-20"
order: 1
layer: interaction
kind: protocol
maturity: active
sourceAuthority: primary
chooseWhen:
  - You need a bidirectional connection between an agent backend and a product-owned frontend.
  - Your experience streams text, tools, state changes, activities, interrupts, or user feedback.
avoidWhen:
  - You only need a UI component schema and already have a complete transport and run lifecycle.
composesWith:
  - a2ui
  - openui
  - json-render
  - copilotkit
  - a2a
  - mcp
license: MIT
primarySource: https://docs.ag-ui.com/
officialSources:
  - https://docs.ag-ui.com/
  - https://github.com/ag-ui-protocol/ag-ui
---

## What it solves

AG-UI standardizes the live interaction boundary between an agent and a user-facing application. Its event stream covers run lifecycle, messages, tool calls, shared state, activities and custom extensions. That makes it an interaction protocol, not a visual component library.

## Where it sits

Place AG-UI between the agent runtime and the frontend. A declarative UI payload such as A2UI can travel over AG-UI, while a renderer such as json-render or OpenUI can turn structured output into components. MCP and A2A sit on adjacent boundaries for tools/data and agent-to-agent communication.

## Security boundary

Treat every event and tool argument as untrusted input. Validate event shapes, authorize tool effects on the server, avoid exposing raw chain-of-thought, and reconnect from known state snapshots rather than replaying arbitrary client state.

## Minimal example

```text
user action → RunAgentInput → agent runtime
agent runtime → ordered AG-UI events → frontend state and UI
```

Use the event lab to step through a deterministic lifecycle before connecting a real model.
