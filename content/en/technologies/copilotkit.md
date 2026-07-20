---
slug: copilotkit
title: CopilotKit
summary: A frontend and runtime platform for agentic applications, Generative UI patterns, and integrations built around the AG-UI ecosystem.
lastVerified: "2026-07-20"
order: 7
layer: implementation
kind: platform
maturity: active
sourceAuthority: primary
chooseWhen:
  - You want production-oriented React components and runtime integrations around AG-UI rather than implementing every client primitive yourself.
  - You need controlled, declarative, or MCP Apps-based Generative UI patterns in one frontend stack.
avoidWhen:
  - You only need the vendor-neutral protocol types or are building a non-React client with a deliberately minimal dependency surface.
composesWith:
  - ag-ui
  - a2ui
  - mcp-apps
  - open-json-ui
license: MIT
primarySource: https://github.com/CopilotKit/CopilotKit
officialSources:
  - https://github.com/CopilotKit/CopilotKit
  - https://docs.copilotkit.ai/
---

## What it solves

CopilotKit provides frontend components, hooks, runtime integration and Generative UI patterns for agentic applications. It is also the project ecosystem from which AG-UI emerged.

## Where it sits

Think of CopilotKit as an implementation platform above AG-UI. It can render predefined frontend tools, integrate A2UI, and host MCP Apps middleware while the protocol remains independently usable by other clients and runtimes.

## Trade-off

The platform shortens the path to a polished React experience, but it adds framework conventions. Keep domain logic and protocol contracts separated so a frontend library migration does not rewrite the agent runtime.

## Security boundary

Review every frontend tool, middleware connection and rendering adapter. Tool visibility is not authorization; privileged effects must remain enforced on the server.

## Minimal example

```text
React surface + CopilotKit frontend tool
  ↕ AG-UI events
Copilot runtime adapter ↔ agent framework
```

Start with one read-only frontend tool, then add confirmation and server authorization before enabling mutations.
