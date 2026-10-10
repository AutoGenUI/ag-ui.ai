# Generative UI acceptance checklist

## Contract

- Validate the incoming conversation or run payload.
- Verify ordered lifecycle and start-delta-end sequences.
- Verify state snapshot replacement and delta ordering.
- Verify tool inputs, outputs, errors, approval, and cancellation.
- Verify unknown event and component behavior is safe.

## Interface

- Exercise empty, loading, streaming, success, error, stopped, and retry states.
- Verify keyboard navigation, focus visibility, labels, contrast, and reduced motion.
- Verify desktop and mobile layouts in a real browser.
- Render model text as streaming markdown and structured output as typed components.
- Avoid raw JSON unless the product explicitly offers a developer inspector.

## Retrieval and teaching

- Test representative queries against expected source documents.
- Show source receipts without exposing private context.
- Distinguish verified fact, inference, recommendation, and planned integration.
- Keep one no-key deterministic learning path operational.

## Models and secrets

- Exercise the exact deployed provider and model ID.
- Confirm deployment keys never reach the client bundle.
- Confirm BYOK values are not persisted or logged.
- Reject private, local, and non-allowlisted custom provider hosts.
- Bound request size, output tokens, time, retries, and agent steps.
- Install abuse protection before turning on a shared trial key.

## Release evidence

- Run repository content, unit, lint, type, build, bundle, and security gates.
- Inspect the browser console and network event stream.
- Confirm deployed environment bindings and model connectivity separately from local success.
- Record rollback scope and keep production unchanged until explicitly approved.
