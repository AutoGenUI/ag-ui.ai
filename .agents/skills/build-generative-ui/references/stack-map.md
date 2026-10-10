# Generative UI stack map

Use this map to separate responsibilities before selecting products.

| Boundary | Primary question | Typical choices |
|---|---|---|
| LLM | Which model can produce the needed text, tools, or schema reliably? | DeepSeek, OpenAI, Anthropic, open models |
| Agent runtime | Who loops, invokes tools, manages state, and stops? | AI SDK agent, Agents SDK, LangGraph, custom runtime |
| Context | What knowledge and procedures enter the run? | Prompts, Agent Skills, keyword RAG, embeddings, MCP resources |
| Agent to tools/data | How are actions and context discovered? | MCP tools, resources, prompts |
| Agent to user | How do lifecycle, text, tools, and shared state reach the client? | AG-UI or an application-specific event stream |
| UI intent | How does the model describe runtime UI composition? | json-render, OpenUI Lang, A2UI, typed data parts |
| Embedded surface | How can a tool return an interactive remote surface? | MCP-UI, MCP Apps, sandboxed iframe/remote DOM |
| Coding-agent client | How do editors communicate with coding agents? | ACP |
| Renderer | Which trusted components become pixels and actions? | React, shadcn/ui, Tailwind, native renderers |

## Selection rules

- AG-UI and A2UI compose: AG-UI carries interaction and state events; A2UI describes a UI surface.
- MCP and AG-UI compose: MCP connects the agent to capabilities; AG-UI connects the agent to the user-facing application.
- MCP-UI is not a general replacement for a host design system. Use it for remote interactive resources with isolation.
- OpenUI optimizes compact streaming composition; json-render favors JSON-native typed catalogs; A2UI targets portable renderer-owned native UI.
- ACP targets editor-to-coding-agent interoperability and usually sits beside, not inside, an end-user chat surface.
- shadcn/ui and Tailwind implement the trusted renderer; they do not define an agent protocol.

## Minimum proof

For every chosen layer, identify:

1. The concrete repository file or endpoint
2. The input/output schema
3. A deterministic fixture
4. The browser-visible state
5. The failure and cancellation behavior
6. The production security boundary
