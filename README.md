# AG-UI.AI — Generative UI Atlas

AG-UI.AI is an independent, bilingual field guide for understanding, choosing, and safely operating a Generative UI stack. It maps interaction protocols, declarative UI specifications, embedded host surfaces, renderers, and integration frameworks without treating different architectural layers as mutually exclusive competitors.

> Independent community resource. This project is not affiliated with or endorsed by the maintainers of AG-UI, A2UI, OpenUI, json-render, MCP, CopilotKit, or other technologies it covers.

## What ships in the first release

- English and Simplified Chinese routes at `/en` and `/zh`
- four-layer ecosystem map and seven core technology profiles
- comparison matrix and deterministic stack selector
- three learning paths and a no-key AG-UI event stream lab
- generated `/catalog.json`, `/search-index.json`, `/feed.xml`, sitemap, robots, canonical and `hreflang` metadata
- GitHub-first community workflow with source verification and weekly drift checks

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local site opens at `http://localhost:3000`. Content is compiled before development and production builds.

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

`npm run check:sources` inspects declared upstream GitHub repositories and writes a review report. It never edits published content. `npm run check:bundle` enforces first-party client JavaScript and CSS budgets; Core Web Vitals are measured again against the private deployment before public launch.

## Content model

Markdown lives under `content/{en,zh}/{technologies,learn,updates}`. A bilingual pair must keep the same filename and `slug`. Raw HTML is not rendered. Each technology profile records its ecosystem layer, maturity, source authority, decision boundaries, composition options, license, official sources, and last verification date.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md) before changing guidance.

Release evidence and the public-launch decision boundary are tracked in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

## Licensing

- Source code: [MIT](LICENSE)
- Original editorial content: [CC BY 4.0](LICENSE-CONTENT)

Third-party names remain the property of their respective owners; see [TRADEMARKS.md](TRADEMARKS.md).
