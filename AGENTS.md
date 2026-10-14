# AG-UI.AI project continuity

Read [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) and
[docs/CURRENT_STATE.json](docs/CURRENT_STATE.json) before changing this project.
Then read [docs/operations/README.md](docs/operations/README.md) and the relevant
DNS, email, owner or deployment manual before operational changes. These are
public engineering records with dated evidence, not live configuration.

- Continue the existing bilingual Generative UI newsroom, atlas and academy.
  Preserve the existing Sites project, public domain and old routes.
- The October 13, 2026 v12 handoff and subsequent v1.0.0 release record public
  email as enabled. Use the dated public release records to distinguish
  production from a newer candidate. Earlier v5 reports and pre-activation
  examples are historical; do not toggle production email based on them.
- Inspect the actual checkout, local changes, latest remote and current PR
  before Git changes. Preserve user work and remote commits; use a suitable
  existing worktree. Never silently stash, clean, reset or force-push.
- Preserve required `verify`, branch protection, security checks and bundle
  budgets. Report failures accurately; a successful build is not a passing CI.
- Main is the retained integration branch. Use a temporary PR branch for
  authorized iterations, merge normally after required checks, verify content
  preservation and remove the merged branch. Do not remove protected/pinned
  worktrees to enforce this policy; a detached checkout can retain them safely.
- GitHub merge does not deploy Sites. Reuse the existing project identity in
  `.openai/hosting.json`; public-launch DNS rollback records are historical and
  must not be applied to the current subscription-enabled service.
- Respect the current user-authorized scope. The historical v12 GitHub
  synchronization did not authorize deployment, DNS, configuration, schedule
  changes or real mail. Later authorization is recorded separately; a local
  candidate, GitHub merge or documentation change is not a Sites deployment.
- Keep private handoff/audit materials outside the public repository. Do not
  read or copy secret values, private mailboxes, subscriber data, signed links
  or browser sessions into documentation, logs or commits.
- Use isolated local D1 and a local Worker for HTTP tests. Keep local mail
  flags false and use no real keys. Never use production as the test target,
  impersonate an owner, or invoke `mail-test` from editorial schedules.
- Confirmation uses a same-origin POST automatically only when its signed
  confirmation page is visible, non-prerendered and ready. Attempt at most
  once per mount; a language remount may retry idempotently. GET, HEAD, SSR
  and HTTP preload do not confirm. A JavaScript-capable bot can mimic a visible
  page; never claim visibility proves a human or prevents every scanner.
- Cancellation and unsubscribe still require an explicit reader POST. Preserve
  capacity, test isolation, generation/epoch guards, old-request cancellation,
  idempotency and suppression. Public unsubscribed recipients may begin a new
  cycle only through fresh valid consent and monotonically newer link clocks;
  never use public signup to revive suppressed/test identities, historical hard
  failures or unknown submissions. Do not reset quotas or purchase allowance.
  A separately authorized owner `mail-test release` may remove only the
  server-configured test role after an exact normalized `expectedRecipient`
  check. It sends no mail, preserves history and rotates signed-link clocks,
  leaving an ordinary unsubscribed recipient who must sign up and confirm
  again. It cannot lift suppression, bypass uncertain submissions, reset
  quotas, automatically subscribe or choose a sending target. Public signup
  cannot perform this release; editorial schedules must never call it.
  Keep provider submission distinct from delivery and inbox acceptance.
- Current subscription layout is introduction, capacity, unified feedback,
  action form, cancellation/unsubscribe, then privacy. Keep feedback above
  the actions it explains across signup and signed management states.
  Prior iteration details are in
  [the normal subscription iteration](docs/iterations/2026-10-13-normal-subscription.md);
  [the v14 iteration](docs/iterations/2026-10-13-subscription-polish.md)
  records the previous layout and deployment. Do not predeclare deployment,
  recipient release or a tag before their actual evidence/authorization.
  The user explicitly authorized v1.0.1 tag, push and deployment on October 13,
  2026. This supersedes the earlier wait-for-acceptance release gate, but is not
  evidence of fresh inbox acceptance. Consult docs/releases/v1.0.1.md for the
  completed tag/deployment mapping; preserve immutable existing tags.
- Preserve accurate tracking and network disclosures. Anonymous Brevo
  tracking is not proof that pixels/rewritten links are disabled. Mainland
  accessibility is not guaranteed.
- Use existing plan resources only: no new paid API calls or purchased quota.

After an authorized iteration, update the public context with the relevant
source revision, evidence time, validation and unresolved limitations. Recheck
current state rather than treating a dated snapshot as a permanent fact.

- Signup rate limits retain existing counts. HTTP 429 carries the next fixed
  bucket retryAt, not rate_limits.expires_at; daily request buckets reset at
  UTC midnight (08:00 Singapore). A denied attempt queues no new mail and must
  not show the check-inbox notice. Owner mail-test diagnose is read-only and
  exact-configured-target scoped, never part of editorial schedules. No private
  identifiers or individual delivery records go into public documentation.

- Every Brevo `to` recipient carries `contactPixelTrackingConsent: false` for
  public and owner-test confirmation/digest mail. Preserve it if adding cc/bcc;
  never retry by removing the flag. Account-side per-contact consent enablement
  is a separate prerequisite; final pixel/link removal needs real-mail evidence.
  See docs/iterations/2026-10-14-brevo-tracking-consent.md for current verification.
