---
slug: secure-and-observe
title: Secure and observe the generated surface
summary: Design trust boundaries, event tracing, approval gates, recovery paths, and evaluation signals for production Generative UI.
lastVerified: "2026-07-20"
order: 3
duration: 75 min
level: advanced
---

## Treat output as untrusted

Validate every event and declarative payload. Render only registered components, constrain props, sanitize URLs, and never interpret generated HTML or executable code by default.

## Keep authority in tools

The generated interface can propose an action; an authenticated, policy-checked tool performs it. Make consequential operations visible, reversible where possible, and subject to explicit confirmation.

## Trace the full loop

Correlate run, message, tool-call, state and user-action identifiers. Measure invalid payloads, fallback rendering, approvals, retries and task completion—not only token latency.

## Recovery exercise

Use the event lab failure fixture, inspect the rejected component, retry with the safe catalog, approve the action, and confirm the terminal event.
