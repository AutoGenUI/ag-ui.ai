# AG-UI.AI launch checklist

This document separates reproducible local evidence from state-changing GitHub, Sites, and DNS steps. A green local row does not authorize public launch.

## Product and content

| Requirement | Evidence | Status |
| --- | --- | --- |
| Independent bilingual atlas | `/en`, `/zh`, sitewide non-affiliation statement | Ready |
| Seven core technology profiles | 14 aligned Markdown files under `content/{en,zh}/technologies` | Ready |
| Uniform decision coverage | Layer, kind, maturity, authority, choose/avoid, composition, sources, verification date, security boundary, and minimal example validated at build time | Ready |
| Three learning paths | 6 aligned Markdown files under `content/{en,zh}/learn` | Ready |
| Decision center | Deterministic client rules with primary and alternative combinations | Ready |
| AG-UI event lab | Success, failure, retry, state, tool, user-action, and terminal event tests | Ready |
| Updates and community | Bilingual update baseline, RSS, GitHub Discussions/Issues/PR paths | Ready; public repository destinations are enabled |

## Public interfaces and discoverability

| Requirement | Evidence | Status |
| --- | --- | --- |
| Catalog API | Generated `catalog.json`, schema version 1, seven bilingual records | Ready |
| Search and RSS | Generated client index and bilingual feed | Ready |
| SEO | Canonical, `hreflang`, x-default, sitemap, robots, TechArticle and Breadcrumb JSON-LD | Ready |
| No-JavaScript reading | Server-rendered homepage content verified after removing scripts | Ready |
| Social preview | 1536×1024 reviewed `public/og.png` | Ready |

## Quality and security

| Requirement | Evidence | Status |
| --- | --- | --- |
| Content integrity | Zod frontmatter, slug parity, source URLs, raw-HTML rejection, security and example section checks | Ready |
| Functional tests | Content, selector, event reducer, rendered routes, redirects, 404, metadata and policy tests | Ready |
| Responsive UI | 1440px and 390px browser review; matrix overflow contained locally | Ready locally; private-host browser rerun is blocked at the Cloudflare access edge before the Worker |
| WCAG 2.2 AA target | Semantic snapshot, skip link, focus styles, reduced-motion policy, 44px primary navigation targets, and critical small-text contrast checks | Local automated/manual evidence ready; final assistive-technology review remains a release check |
| Performance target | No remote fonts or trackers; client budgets: ≤350 KB raw JavaScript and ≤40 KB raw CSS | Budget ready; deployed LCP/CLS measurement pending |
| Security scope | No accounts, uploads, database, model keys, raw HTML, or third-party tracking | Ready |
| Dependency audit | npm registry audit at High threshold | Ready: zero known vulnerabilities |
| Upstream drift | Repositories, canonical location, branch, archive state, license, latest release, and primary documentation checks | Ready |

## External state gates

| Gate | Required proof | Status |
| --- | --- | --- |
| GitHub identity | `gh api user --jq .login` returns `AutoGenUI` | Ready: verified before repository creation |
| Public repository | `AutoGenUI/ag-ui.ai`, `main`, Discussions enabled, correct `origin` | Ready: repository and community surfaces created |
| Commit authorship | Repository-local `user.name=AutoGenUI` and verified/noreply email | Ready: account-bound noreply address configured |
| Repository protection | Main blocks force pushes and requires green `verify` check | Ready: apply after the final verified push |
| Sites project | One project ID stored in `.openai/hosting.json` | Ready: single project initialized and persisted |
| Private preview | Same Git commit deployed privately and browser-verified | Owner-only deployment ready with zero Worker errors; in-app browser verification is blocked by the hosting edge before the application |
| Public release approval | Explicit owner approval after private-preview report | Not requested yet |
| DNS snapshot and records | Re-read DNSPod immediately before changes; use exact Sites A/CNAME/verification records | Pending approval |
| Domain verification | Apex + `www`, TLS, HTTP→HTTPS, `www`→apex, localized routes, assets, OG | Pending DNS |

## Rollback

Before public launch, keep Sites private. After custom-domain launch, rollback means removing only the records added for Sites and restoring private access; Namecheap DNSPod nameservers remain unchanged.
