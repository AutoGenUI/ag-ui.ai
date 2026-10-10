---
name: build-generative-ui
description: Design, implement, or review Generative UI applications and features that combine chat, agent events, structured UI, tools, retrieval, and model providers. Use when a task mentions AG-UI, A2UI, OpenUI, json-render, AI SDK, MCP-UI, agent-driven interfaces, streaming UI, BYOK, or asks to build a ChatGPT-like agent application.
---

# Build Generative UI

Build one observable vertical slice from user intent to rendered interaction. Keep protocol layers explicit and treat every model- or server-produced UI description as untrusted input.

## 1. Map the requested capability

Write down these boundaries before editing code:

1. User task and success signal
2. Model output: text, tool call, or structured UI intent
3. Agent responsibility: tools, state, loop, approval, recovery
4. Interaction transport: AG-UI events or an application-specific stream
5. UI description: json-render, OpenUI, A2UI, MCP-UI, or none
6. Trusted renderer and allowed component catalog
7. Persistence, retrieval, identity, and secret boundary

Read [references/stack-map.md](references/stack-map.md) when selecting technologies or explaining how the protocols compose.

## 2. Choose the smallest valid stack

- Use markdown plus a trusted renderer for explanatory answers.
- Use typed message/data parts for known result cards.
- Add a declarative UI format only when runtime composition is a requirement.
- Use AG-UI when a frontend must observe agent lifecycle, messages, tools, or shared state across a real agent boundary.
- Use MCP for tools, resources, and prompt discovery; use MCP-UI only when a tool must return an interactive surface.
- Add RAG only after deterministic repository or keyword retrieval fails measured scenarios.
- Keep provider routing behind one adapter and keep user API keys ephemeral by default.

Do not claim that one protocol replaces another when they connect different endpoints.

## 3. Implement a vertical slice

Implement in this order:

1. Define runtime schemas and a safe component or event vocabulary.
2. Produce a deterministic fixture before connecting a model.
3. Stream lifecycle, state, tool, and content events in order.
4. Render text through a streaming markdown component and structured data through known components.
5. Add empty, submitted, streaming, stopped, error, and retry states.
6. Connect one model provider through a server-side adapter.
7. Add BYOK without persisting the key or accepting unrestricted provider URLs.
8. Add retrieval receipts so users can inspect which sources shaped the answer.

Keep the no-key fixture working. It is the protocol test oracle and a useful learning mode.

## 4. Enforce trust boundaries

- Validate request bodies, events, tool inputs, structured output, and component props.
- Allowlist renderer components and actions; never execute model-generated code.
- Require explicit user approval for destructive or external side effects.
- Keep deployment keys server-side. Never log, cache, store, or echo BYOK values.
- Block local and private provider hosts. Require an operator allowlist for custom upstreams.
- Sandbox embedded remote UI and constrain navigation, messaging, CSP, and permissions.
- Bound agent steps, output size, request size, time, retries, and tool result size.
- Return sanitized user-facing errors while retaining owner-only diagnostics.
- Add real rate limiting and abuse protection before enabling a shared free-trial key.

## 5. Make the product teach itself

For educational applications, expose the implementation without exposing secrets:

- Name the lesson or architectural layer in the interface.
- Show a sanitized event trace and retrieval receipts.
- Link to the repository artifact and primary source.
- End each explanation with one runnable experiment.
- Label planned integrations as extension paths rather than shipped capabilities.

## 6. Verify the complete story

Read [references/acceptance.md](references/acceptance.md) and run the relevant gates. A local type check is not proof that the browser received, interpreted, and rendered the intended protocol flow.

Report:

- What shipped and which path demonstrates it
- Which provider/runtime path was actually exercised
- Security and cost controls that remain before public trial
- Any difference between deterministic, local-model, and deployed behavior
