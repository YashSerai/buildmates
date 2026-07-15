# Buildmates Launch Checkpoint

Updated: 2026-07-15, Task 3 approved and ready to integrate
Status: active

## TodoCheckpointDraft

- Current todo: commit and push Task 3, then begin Task 4 SurfaceSpec and Design Policy implementation.
- Active slice: integrate the approved canonical domain and authorization foundation.
- Completed todos: Tasks 1 and 2; seventh-repaired Task 3 candidate with 81 D1 tables, canonical Audience, complete grouped typed D1/memory repositories, actor/target separation, schema-enforced proposal-to-room pair lineage, derived Connection/room members, typed expiry-aware idempotency, atomic cohort/Circle ownership transfer, block-aware failure-atomic shared-Surface publication, standing-based appeals, approved collaborator access, privilege-preserving invitation activation and card payload consumption, regression invariants, labeled fixtures, and migrations 0003-0005.
- Evidence refs: `GOAL.md`, canonical specs and plan, GitHub remote, `docs/evidence/sites-capability-gate.md`, migrations 0000-0003, permission tests, full aggregate repository parity tests, local D1 migration output, and local lint/typecheck/build.
- Blocked on: nothing.
- Next step: commit and push Task 3, then dispatch the bounded Task 4 implementer.

## ResumeStateHint

Read `10-intent.md`, this checkpoint, `GOAL.md`, and `BUILD_INDEX.md`; verify the worktree, branch, and Git status before resuming. Never resume from chat memory alone.

## DriftCheckDraft

- Intent: aligned.
- Scope: aligned with Task 3 and the launch goal; later feature behavior is represented as data contracts without implementing later UI/state-machine lanes early.
- Compatibility: migrations use SQLite/D1-supported DDL and preserve the Task 2 identity/OAuth tables without a second identity authority; migration 0005 orders parent composite keys before dependent table rebuilds.
- New owner/fallback: database interfaces keep local memory and D1 adapters behaviorally aligned; the signed service client keeps the external MCP topology host-neutral.
- Evidence sufficiency: generated and inspected migrations, repeated fresh Miniflare D1 apply through 0005, canonical audience authorization, all named aggregate boundaries on both adapters, comprehensive second-user actor-forgery and crossed-pair denials, exactly-one-owner transfer invariants, expiry-aware idempotency outcomes, transactional fault injection for Surface publication and Circle voting, concurrent publish/vote retries, room/Circle approval thresholds, stale base/governance/CAS denials, standing-based appeals, approved-collaborator access, lint, typecheck, tests, and build pass; independent specification/security and quality rereviews both approve.
- Decision: continue.
