# AG-UI.AI — Generative UI intelligence

AG-UI.AI is an independent bilingual news, timeline and research publication focused on Generative UI. It retains the original technology atlas and conversational academy as a secondary learning experience. See the newsroom redesign section below for current operations.

> Independent community resource. This project is not affiliated with or endorsed by the maintainers of AG-UI, A2UI, OpenUI, json-render, MCP, CopilotKit, or other technologies it covers.

## Retained conversational academy

- ChatGPT-style English and Simplified Chinese learning surfaces at `/en/learn/academy` and `/zh/learn/academy`
- sixteen lessons covering AG-UI, AI SDK, AI Elements, shadcn/ui, Tailwind, json-render, OpenUI, A2UI, MCP, MCP-UI, ACP, prompts, Agent Skills, RAG, agents, LLMs, BYOK, and release practice
- a real AG-UI `RunAgentInput` → SSE event path with lifecycle, retrieval tool, state snapshot, and text events
- deterministic no-key tutoring plus an opt-in DeepSeek trial and ephemeral BYOK provider settings
- a GitHub-backed lexical RAG baseline with visible source receipts and no required database
- an installable `.agents/skills/build-generative-ui` Skill, a public prompt contract, and architecture documentation
- the existing ecosystem map, comparison matrix, technology profiles, learning pages, and no-key event lab
- generated `/catalog.json`, `/search-index.json`, `/feed.xml`, sitemap, robots, canonical and `hreflang` metadata
- GitHub-first community workflow with source verification and weekly drift checks

The shared DeepSeek trial is off by default. Set `TRIAL_ENABLED=true` and the server-only `DEEPSEEK_API_KEY` only after rate limiting, budget controls, abuse monitoring, and a kill switch are ready. Custom OpenAI-compatible hosts must be listed in `CUSTOM_PROVIDER_HOSTS`.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local site opens at `http://localhost:3000`. Content is compiled before development and production builds. Without model environment variables, the full AG-UI flow remains usable through the deterministic offline tutor.

## Quality gates

```bash
npm run content:validate
npm run security:audit
npm test
npm run lint
npm run build
npm run check:bundle
npm run test:render
```

`npm run check:sources` inspects declared upstream GitHub repositories and writes a review report. It never edits published content. `npm run check:bundle` caps all route assets at 275 KB gzip JavaScript and 24 KB gzip CSS across the academy, atlas and newsroom (with raw-size backstops); Core Web Vitals are measured again against the private deployment before public launch. See [the conversational architecture](docs/architecture/conversational-academy.md) for runtime, provider, RAG, and extension boundaries.

## Content model

Markdown lives under `content/{en,zh}/{technologies,learn,updates}`. A bilingual pair must keep the same filename and `slug`. Raw HTML is not rendered. Each technology profile records its ecosystem layer, maturity, source authority, decision boundaries, composition options, license, official sources, and last verification date.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md) before changing guidance.

Release evidence and the public-launch decision boundary are tracked in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

## Licensing

- Source code: [MIT](LICENSE)
- Original editorial content: [CC BY 4.0](LICENSE-CONTENT)

Third-party names remain the property of their respective owners; see [TRADEMARKS.md](TRADEMARKS.md).

## Newsroom redesign (October 2026)

The home routes now serve independent Generative UI news. The academy is retained at `/en/learn/academy` and `/zh/learn/academy`; map, compare, technology profiles and lab URLs remain valid.

- 25 reviewed bilingual seed events; four perspectives; source registry and dated revisions.
- Managed D1 news, source checks, trends, run checkpoints, subscriptions, editions, delivery states and first-party metrics.
- `POST /mcp` exposes `newsroom_read` and `newsroom_write` to the authenticated Site owner only. `/admin` is the owner operations screen. Public discovery does not grant tool access.
- `/en/feed.xml`, `/zh/feed.xml` and `/feed.xml` serve dynamic RSS. `/legacy-feed.xml` retains the old atlas feed.
- Automated editorial policy and tool contracts: [public/automation.md](public/automation.md).
- Email is **pending activation**. No mailbox collection or sends occur until all gates are configured. RSS works independently.

### Runtime configuration

Set secrets only through Sites environment variables. `SITE_OWNER_EMAIL` authorizes the verified Sites owner identity; `ANALYTICS_SECRET` derives daily visitor estimates; `SUBSCRIPTION_SECRET` signs confirmation and management links. Never use a Sites viewer or bypass token as owner authorization.

Future email activation requires `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_WEBHOOK_SECRET`, `BREVO_DOMAIN_VERIFIED=true`, `EMAIL_ACCEPTANCE_PASSED=true` and `EMAIL_ENABLED=true`. Keep these last gates false until a real mailbox confirms, receives a digest, changes preferences and unsubscribes, and failure callbacks are verified. Disable provider open/click tracking in Brevo. Configure transactional webhooks with bearer authentication to `/api/brevo/webhook`; subscribe to delivered, hardBounce, softBounce, spam, invalid, blocked and unsubscribed. Official contracts: [secured webhooks](https://developers.brevo.com/docs/secured-webhooks), [transactional events](https://developers.brevo.com/docs/transactional-webhooks).

### Database and acceptance

Schema-only Drizzle migrations live in `drizzle/`. Sites applies them during deployment. Fixed reviewed seed data is inserted idempotently on initial newsroom access; ordinary updates use owner tools, without rebuilds. Never reapply an existing migration. For a fresh local preview database, build once and apply each pending SQL file with:

```sh
WRANGLER_LOG_PATH=.wrangler/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_medical_katie_power.sql
npm run dev -- --port 4173
```

Run `npm run test:news` for database, editorial, queue and metrics tests. `npm run test:render` uses the running Worker at `SITE_TEST_BASE_URL` (default localhost:4173), including actual HTTP auth boundaries. Localhost, browser automation and signed-in owner traffic do not inflate counters. Production checks must use a browser automation user agent or disable telemetry with the existing automation detection.

Collection schedules (08:00/20:00 Singapore) and weekly digest preparation (Monday 09:00) require a fresh cloud task to independently access the original sources, authenticated Site MCP and persisted readback **before enabling**. Merely deploying the endpoint does not prove unattended readiness.
