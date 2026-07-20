# AG-UI.AI public launch record

## Pre-change snapshot

- Captured at: `2026-07-20T08:25:33Z`
- DNS provider UI: DNSPod reported `0` records for `ag-ui.ai`.
- Authoritative nameservers: `structure.dnspod.net`, `charcoal.dnspod.net`.
- SOA: `charcoal.dnspod.net. freednsadmin.dnspod.com. 1747590895 3600 180 1209600 180`.
- Apex `A`, `AAAA`, `CNAME`, and `TXT`: no answers.
- `www` `A`, `AAAA`, and `CNAME`: no answers.
- Sites access: owner-only custom access with one allowed user.
- Sites custom domains: none.

## Rollback boundary

If launch validation fails, remove only the DNS records added for this launch,
remove the two Sites custom-domain bindings if necessary, and restore Sites to
owner-only custom access. Do not change the DNSPod nameserver delegation.

## Change and validation record

- Sites access changed to public at `2026-07-20T08:30:26Z`.
- The existing version was published successfully at `2026-07-20T08:31:08Z`.
- Published version: `appgprj_6a5dcacfcbb4819193bac2b2104ed926~appgver_8cd2415f7c44819192690700cacfe425`.
- Published commit: `f5be09f97dab14595c41bdf22510c0f21d6f5106`.
- Sites fallback URL: `https://ag-ui-ai.channely.chatgpt.site`.
- `ag-ui.ai` and `www.ag-ui.ai` were added to Sites before the DNS change.
- The seven DNSPod records below were added between `2026-07-20T08:51:43Z`
  and `2026-07-20T08:59:48Z`, with TTL `600`.
- `ag-ui.ai` became `active` with `SSL active` at
  `2026-07-20T09:03:34Z`.
- `www.ag-ui.ai` became `active` with `SSL active` at
  `2026-07-20T09:04:05Z`.

### Sites-required DNS records

| Host | Type | Value |
| --- | --- | --- |
| `@` | A | `162.159.143.30` |
| `@` | A | `172.66.3.26` |
| `_openai-site-verification` | TXT | `openai-site-verification=r08B4CnHi9tFnvpHesV19tKAuhXpTTpHjuSgpziK_Bo` |
| `_cf-custom-hostname` | TXT | `6379fe4d-50b1-4c9c-9032-858b6587ebc4` |
| `www` | CNAME | `custom-domains.chatgpt.site.` |
| `_openai-site-verification.www` | TXT | `openai-site-verification=ZtXDeLw10yLiC8ijQ7Uqu5D-ltLTflIY50-PbsQVMV0` |
| `_cf-custom-hostname.www` | TXT | `f5cef6bd-e2aa-4d58-b2e1-f93689b317c2` |

## Launch validation

- Both authoritative nameservers returned both apex A records, the `www`
  CNAME, and all four validation TXT records. The public resolver returned the
  same answers immediately after the change.
- The nameserver delegation remained `structure.dnspod.net` and
  `charcoal.dnspod.net`; Namecheap delegation was not changed.
- TLS certificates were active for both hosts. Each hostname has its own Google
  Trust Services `WE1` certificate and matching SAN. The observed validity
  windows are `2026-07-20` through `2026-10-18`.
- An unauthenticated HTTP request to the apex returned a redirect to HTTPS.
- An independent public fetch reached `/en`, `/zh`, the localized comparison
  page, `catalog.json`, `feed.xml`, `search-index.json`, and `og.png` with final
  status `200`.
- An independent public fetch observed the `www` request redirecting with
  status `308` to the apex site. The deployed worker test also verifies that the
  redirect preserves path and query.
- The live English technology page exposed the expected canonical URL,
  description, title, and OG image. Local rendered-route tests verified
  canonical, `hreflang`, JSON-LD, localized routes, no-JavaScript content, the
  event lab, 404 behavior, and the exact `www` redirect contract.
- Local release gates passed after activation: 22 bilingual content documents,
  14 content/policy/decision/lab tests, 7 rendered-route tests, ESLint, vinext
  production build, bundle budgets, and `npm audit` with zero vulnerabilities.
- GitHub identity was rechecked as `AutoGenUI`; `origin` remained
  `AutoGenUI/ag-ui.ai`; the published commit's main-branch CI run was green.

## Verification limitation

The current corporate/automation browser egress received a Cloudflare 403 for
both the custom domain and the Sites fallback domain. This is not a DNS, TLS, or
custom-domain activation failure: Sites reports both domains active, direct TLS
negotiation succeeds, and two independent public fetch services retrieved the
deployed content successfully. A manual browser check from a non-blocked egress
remains useful as a post-launch observation; it is not a rollback trigger.

## Current rollback point

The site is public and both custom domains are active. If a rollback is later
required, remove only the seven records listed above, remove the two Sites
custom-domain bindings, and restore owner-only Sites access. The DNSPod
nameserver delegation must remain unchanged.
