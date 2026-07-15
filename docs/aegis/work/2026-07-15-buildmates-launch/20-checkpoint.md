# Buildmates Launch Checkpoint

Updated: 2026-07-15, Task 5 MCP/plugin implementation candidate
Status: active

## TodoCheckpointDraft

- Current todo: review and integrate the Task 5 MCP/plugin implementation.
- Active slice: Task 5 final quality findings repaired and locally verified: fail-closed subject-backed Surface briefs, Sites-native authenticated administrator recovery, same-origin link mutations, global-only public MCP scope, the link-code rate-limit index, bounded direct pagination and taxonomy queries, indexed expiry cleanup, authenticated connection setup, follow/watch adapter parity, and shared canonical hashing; independent rereview pending.
- Completed todos: Tasks 1-3; Task 4 candidate and all review repairs, including themed state shells, guaranteed two-tone focus, populated-safe historical policy backfill, a versioned parser/policy registry that preserves `.1` reads under active `.2`, srcdoc breakout defenses, iterative deep-input preflight, streaming upload caps, non-destructive object handling, no-store asset revocation, bounded indexed asset lookup, and removal of current font upload support.
- Evidence refs: `GOAL.md`, canonical specs and plan, GitHub remote, `docs/evidence/sites-capability-gate.md`, migrations 0000-0013, 30 focused final-finding tests, 60 unit tests, 29 integration tests, 26 MCP contract tests, 10 desktop/phone E2E tests, fresh/populated D1 migration output, and local lint/typecheck/build.
- Blocked on: only the account-side ChatGPT app creation needed to obtain a real app ID; source intentionally contains no invented ID. No local implementation blocker is open.
- Next step: run Task 5 independent specification/security and quality reviews, repair findings, then bind the real app ID when account creation is available.

## ResumeStateHint

Read `10-intent.md`, this checkpoint, `GOAL.md`, and `BUILD_INDEX.md`; verify the worktree, branch, and Git status before resuming. Never resume from chat memory alone.

## DriftCheckDraft

- Intent: aligned.
- Scope: aligned with Task 4 and the launch goal; final brand/art direction remains deferred while the functional generative-surface boundary is complete.
- Compatibility: migrations use SQLite/D1-supported DDL and preserve the Task 2 identity/OAuth tables without a second identity authority; migration 0005 orders parent composite keys before dependent table rebuilds.
- New owner/fallback: database interfaces keep local memory and D1 adapters behaviorally aligned; the signed service client keeps the external MCP topology host-neutral.
- Evidence sufficiency: generated and inspected migrations, repeated fresh Miniflare D1 apply through 0005, canonical audience authorization, all named aggregate boundaries on both adapters, comprehensive second-user actor-forgery and crossed-pair denials, exactly-one-owner transfer invariants, expiry-aware idempotency outcomes, transactional fault injection for Surface publication and Circle voting, concurrent publish/vote retries, room/Circle approval thresholds, stale base/governance/CAS denials, standing-based appeals, approved-collaborator access, lint, typecheck, tests, and build pass; independent specification/security and quality rereviews both approve.
- Decision: continue.
