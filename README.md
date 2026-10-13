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
- Public email subscription is controlled by activation gates and a site policy of at most 250 confirmed public subscribers. This policy matches the existing weekly budget; it is not Brevo's contact-list limit. Pending and test records do not occupy confirmed places. Full capacity pauses new signup and confirmation until a place is released, while preferences, reading and unsubscribe remain available. A separately gated owner acceptance operation can send only to its server-configured test recipient. RSS works independently.

### Runtime configuration

Set secrets only through Sites environment variables. `SITE_OWNER_EMAIL` authorizes the verified Sites owner identity; `ANALYTICS_SECRET` derives daily visitor estimates; `SUBSCRIPTION_SECRET` signs confirmation and management links. Never use a Sites viewer or bypass token as owner authorization.

Email activation requires `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_WEBHOOK_SECRET`, `BREVO_DOMAIN_VERIFIED=true`, `EMAIL_ACCEPTANCE_PASSED=true` and `EMAIL_ENABLED=true`. Keep `EMAIL_ENABLED` and `EMAIL_ACCEPTANCE_PASSED` false until a real mailbox confirms, receives a digest, changes preferences and unsubscribes, and authenticated callbacks are verified. With the owner's acceptance and accurate public disclosure, anonymous Brevo open/click tracking may remain enabled; anonymizing tracking does not disable pixels or tracked links. The site does not use these statistics to decide whether to send mail or as proof that an email was read. Fully disabling tracking remains a future privacy improvement. Configure transactional webhooks with bearer authentication to `/api/brevo/webhook`; subscribe to delivered, hardBounce, softBounce, spam, invalid, blocked and unsubscribed. Official contracts: [secured webhooks](https://developers.brevo.com/docs/secured-webhooks), [transactional events](https://developers.brevo.com/docs/transactional-webhooks).

For real delivery acceptance before public activation, also configure `EMAIL_TEST_RECIPIENT` as a server-side secret containing the one explicitly authorized test address. Keep `EMAIL_ENABLED=false` and `EMAIL_ACCEPTANCE_PASSED=false`. The owner-only `newsroom_write` / `/api/admin` operation `mail-test` requires a verified domain, sender, API key, webhook secret and existing subscription signing secret. It cannot take a recipient argument, enable public email, or drain the production queue. Do not invoke it from scheduled editorial tasks.

`GET /api/subscription/status` exposes only aggregate capacity: enabled state, confirmed public count, capacity, remaining places, full state, 300 daily submission limit and 250 weekly submission budget. Signup and confirmation enforce capacity atomically. A full-capacity operation returns HTTP 409 with `status: "capacity-full"` and `aggregateCapacity` in the same shape; an unexpired pending confirmation link can be retried after someone unsubscribes. Already confirmed replays remain idempotent. Unapplied preference changes return HTTP 409 rather than claiming a successful save. No API count includes test recipients or exposes mailbox addresses.

1. Call `mail-test` with `{"action":"status"}` to check readiness, saved test preferences and active run metadata. Responses never contain the recipient, credentials or signed links.
2. Call with `{"action":"confirmation","runId":"acceptance-unique-stable-id","locale":"zh","topics":["model","product"]}`. The authorized recipient opens the actual email and confirms through the signed link. The same preference and unsubscribe page works while public signup is disabled.
3. After confirmation, call with `{"action":"weekly","runId":"acceptance-unique-stable-id"}`. This sends a labeled sample of up to five real published events matching the saved preferences. Reuse the exact run ID on retry; submitted, delivered, failed or uncertain records are not resent. The delivery callback and actual inbox receipt must both be checked; submitted is not delivered.
4. Verify preference changes, successful unsubscribe, authenticated callbacks, and suppression. Test records are explicitly marked in the database and excluded from public weekly editions, ordinary draining, subscriber counts and conversion statistics. They still consume the same conservative provider quota. Ordinary draining cannot flush test mail, even after public email is enabled. A changed configured recipient cannot flush the old test recipient's queue. Ordinary confirmation/weekly calls never reactivate an unsubscribed or suppressed test recipient. A production subscriber cannot be repurposed for testing.
5. Only after the owner explicitly authorizes another acceptance run, call `{"action":"restart","runId":"new-unique-stable-id","locale":"zh","topics":["model","product"]}`. This state-only operation sends no mail and only reopens the configured `is_test=1` recipient from `unsubscribed` while public email is disabled. It refuses suppressed/production recipients and any sending/uncertain submission, retains history, and invalidates old signed links. Continue confirmation and weekly with this new run ID only. Replaying a recorded restart never reopens a completed or opted-out run; old run IDs cannot send again. Never silently reset the database.
6. Only after documenting real acceptance results, set the public activation gates. The test operation never changes these gates. Before the first restart, an explicitly requested new run ID can replace a known expired confirmation; after a restart only its active run ID may send. Uncertain submissions require provider reconciliation and are never automatically retried. Test identities remain test identities and are never automatically enrolled in the public newsletter.

### Database and acceptance

Schema-only Drizzle migrations live in `drizzle/`. Sites applies them during deployment. Fixed reviewed seed data is inserted idempotently on initial newsroom access; ordinary updates use owner tools, without rebuilds. Never reapply an existing migration. For a fresh local preview database, build once and apply each pending SQL file with:

```sh
WRANGLER_LOG_PATH=.wrangler/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_medical_katie_power.sql
WRANGLER_LOG_PATH=.wrangler/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_mail_acceptance_isolation.sql
npm run dev -- --port 4173
```

Run `npm run test:news` for database, editorial, queue and metrics tests. `npm run test:render` uses the running Worker at `SITE_TEST_BASE_URL` (default localhost:4173), including actual HTTP auth boundaries. Localhost, browser automation and signed-in owner traffic do not inflate counters. Production checks must use a browser automation user agent or disable telemetry with the existing automation detection.

Collection schedules (08:00/20:00 Singapore) and weekly digest preparation (Monday 09:00) require a fresh cloud task to independently access the original sources, authenticated Site MCP and persisted readback **before enabling**. Merely deploying the endpoint does not prove unattended readiness.
