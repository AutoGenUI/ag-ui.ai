# Security policy

## Reporting a vulnerability

Do not open a public Issue for a vulnerability that could put users or deployment infrastructure at risk. Use GitHub's private vulnerability reporting for `AutoGenUI/ag-ui.ai` once the repository is available. If that channel is unavailable, contact the repository owner privately through the verified organization profile.

Include the affected route or component, reproduction steps, impact, and any suggested mitigation. Maintainers will acknowledge a valid report as soon as practical and coordinate disclosure after a fix is ready.

## Current security boundary

The first release has no user accounts, comments, uploads, database, model keys, or third-party analytics. Markdown is rendered without raw HTML. The event lab uses deterministic local fixtures and performs no privileged operation.

Examples and guidance are educational. Production systems must validate generated events and UI schemas, constrain components and properties, authenticate tools, require confirmation for consequential actions, and sandbox embedded content.
