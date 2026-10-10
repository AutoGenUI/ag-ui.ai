---
slug: build-this-app
title: Rebuild AG-UI.AI from zero to one
summary: A sixteen-lesson, inspectable path from a trusted chat shell to AG-UI events, runtime UI, retrieval, BYOK, evaluation, and release.
lastVerified: "2026-07-22"
order: 0
duration: 6–10 hours
level: foundation
---

## Outcome

You will rebuild the application you are using as a small, source-verifiable Generative UI system. Each lesson produces one repository artifact and one browser-visible proof.

## The five phases

1. **Foundations:** separate the LLM, agent, context, interaction protocol, UI description, and trusted renderer; then build the Next.js, shadcn/ui, Tailwind, AI SDK, and AI Elements shell.
2. **Interface generation:** compare typed data parts, json-render, OpenUI Lang, and A2UI. Start with the narrowest catalog that solves a real task.
3. **Protocols:** implement AG-UI lifecycle, message, tool, and state events. Place MCP, MCP-UI, and ACP at their actual endpoints.
4. **Context engineering:** version prompts, package repeatable work as Agent Skills, and begin RAG with deterministic repository retrieval.
5. **Production:** isolate deployment and BYOK keys, restrict upstream providers, add abuse protection, evaluate scenarios, observe traces, and record rollback.

## How to use the conversational course

Open the home page and choose a lesson from the left rail. The tutor will retrieve related repository content, update the lesson artifact, and stream its answer through `/api/agent`. The right inspector exposes the ordered AG-UI events.

Use the offline tutor first. It is deterministic, needs no key, and acts as the protocol test oracle. Enable a real provider only after the event path works.

## Completion proof

You are done when you can explain and demonstrate:

- why AG-UI and A2UI or json-render can compose;
- how the server keeps provider keys out of the client bundle;
- how an untrusted UI description becomes a trusted component;
- which source shaped an answer and which part is a recommendation;
- how stopping, provider failure, invalid events, and rollback appear to the user.

The final result must pass content, contract, accessibility, browser, build, bundle, and security gates. A successful local model response alone is not release proof.
