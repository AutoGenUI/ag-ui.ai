---
slug: mcp-apps
title: MCP Apps
summary: An official MCP extension for serving sandboxed interactive HTML interfaces from MCP servers into compatible conversational hosts.
lastVerified: "2026-07-20"
order: 6
layer: embedded
kind: extension
maturity: stable
sourceAuthority: primary
chooseWhen:
  - Your interface must render inside a compatible AI chat host and call server tools through the host.
  - You need rich forms, dashboards, media, or multi-step workflows with iframe isolation and bidirectional context.
avoidWhen:
  - You own a conventional web application and do not benefit from host embedding, context preservation, or MCP tool access.
composesWith:
  - json-render
  - mcp
license: Specification terms
primarySource: https://modelcontextprotocol.io/extensions/apps/overview
officialSources:
  - https://modelcontextprotocol.io/extensions/apps/overview
  - https://github.com/modelcontextprotocol/ext-apps
---

## What it solves

MCP Apps links an MCP tool to a `ui://` resource. A compatible host fetches the HTML view, renders it in a sandboxed iframe and brokers JSON-RPC communication between the view, model context and server tools.

## Where it sits

This is a host-embedded application mechanism. It is not a portable declarative component tree like A2UI and not a general agent-to-owned-frontend event protocol like AG-UI.

## Host dependency

Support varies by client. Confirm capability negotiation and the client matrix before choosing MCP Apps as a distribution target.

## Security boundary

Use the mandatory sandbox, declare the narrowest content security policy and permissions, treat tool results as untrusted, and keep server-side authorization independent from anything displayed by the view.

## Minimal example

```text
MCP tool result → references ui://atlas/comparison
compatible host → fetches resource → sandboxed iframe
iframe action → host bridge → authorized MCP tool
```

Capability detection and a text fallback are required because not every MCP client renders Apps.
