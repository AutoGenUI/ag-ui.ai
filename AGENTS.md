# AG-UI.AI project continuity

Read [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) and
[docs/CURRENT_STATE.json](docs/CURRENT_STATE.json) before changing this project.
Then read [docs/operations/README.md](docs/operations/README.md) and the relevant
DNS, email, owner or deployment manual before operational changes. These are
public engineering records with dated evidence, not live configuration.

- Continue the existing bilingual Generative UI newsroom, atlas and academy.
  Preserve the existing Sites project, public domain and old routes.
- The October 13, 2026 handoff records production v12 and public email as
  enabled. Earlier v5 reports and pre-activation examples are historical.
  Do not re-enable or disable production email based on those examples.
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
- Respect the current user-authorized scope. The v12 handoff/synchronization
  covers GitHub and public documentation only, without deployment, DNS,
  production configuration, schedule changes or real mail.
- Keep private handoff/audit materials outside the public repository. Do not
  read or copy secret values, private mailboxes, subscriber data, signed links
  or browser sessions into documentation, logs or commits.
- Use isolated local D1 and a local Worker for HTTP tests. Keep local mail
  flags false and use no real keys. Never use production as the test target,
  impersonate an owner, or invoke `mail-test` from editorial schedules.
- Preserve active POST confirmation/unsubscribe, capacity enforcement, test
  isolation, generation/epoch guards, idempotency and suppression. Keep
  provider submission distinct from delivery and inbox acceptance.
- Preserve accurate tracking and network disclosures. Anonymous Brevo
  tracking is not proof that pixels/rewritten links are disabled. Mainland
  accessibility is not guaranteed.
- Use existing plan resources only: no new paid API calls or purchased quota.

After an authorized iteration, update the public context with the relevant
source revision, evidence time, validation and unresolved limitations. Recheck
current state rather than treating a dated snapshot as a permanent fact.
