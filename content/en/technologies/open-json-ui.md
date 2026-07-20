---
slug: open-json-ui
title: Open-JSON-UI
summary: An emerging declarative JSON UI concept documented by CopilotKit, without a separately verified first-party OpenAI specification repository.
lastVerified: "2026-07-20"
order: 5
layer: declarative
kind: specification
maturity: emerging
sourceAuthority: ecosystem
chooseWhen:
  - You are evaluating the CopilotKit Generative UI examples that explicitly describe Open-JSON-UI payloads.
  - You can tolerate an emerging contract and will isolate it behind your own validated adapter.
avoidWhen:
  - Procurement, compliance, or long-term interoperability requires a first-party published specification and independent conformance suite.
composesWith:
  - ag-ui
  - copilotkit
license: Unverified
primarySource: https://github.com/CopilotKit/generative-ui
officialSources:
  - https://github.com/CopilotKit/generative-ui
  - https://docs.showcase.copilotkit.ai/agno/generative-ui/open-json-ui
---

## Evidence status

CopilotKit describes Open-JSON-UI as a declarative Generative UI option and shows illustrative JSON payloads. At the last verification date, this atlas could not confirm a standalone first-party OpenAI specification repository, versioning policy or conformance suite.

## What it solves and where it sits

The documented idea expresses UI as JSON that a client maps to controlled components. That places it in the declarative rendering layer; it does not define the surrounding agent run or transport lifecycle.

## How to evaluate it

Treat the current material as an ecosystem-documented concept, not as proof of an OpenAI-backed industry standard. Ask which schema version your renderer accepts, who owns compatibility, and where validation behavior is specified.

## Safe adoption path

Place any Open-JSON-UI payload behind a local adapter and schema validator. Keep an escape path to another component catalog format, and record the exact documentation snapshot that informed your implementation.

## Minimal example

```json
{
  "type": "Notice",
  "props": { "tone": "info", "text": "Review required" }
}
```

This is a conceptual payload, not a claim of normative schema. Accept it only through a locally versioned adapter and allow-list.
