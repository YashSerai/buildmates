# Buildmates Launch Checkpoint

Updated: 2026-07-15, Task 2 local implementation complete  
Status: active

## TodoCheckpointDraft

- Current todo: commit and push Task 2, run the private ChatGPT Sites production capability probe, then begin Task 3 domain schema and authorization core.
- Active slice: source-control and deployment truth for the approved Task 2 substrate.
- Completed todos: Tasks 1 and 2 local implementation, including stable web identity, OAuth 2.1 and PKCE, refresh-family replay defense, Streamable HTTP MCP, explicit identity linking, delegated assertions, D1/R2 capability routes, real local-D1 security tests, and Windows smoke automation.
- Evidence refs: `GOAL.md`, canonical specs and plan, GitHub remote, `docs/evidence/sites-capability-gate.md`, migrations 0000-0002, 11 integration tests, smoke output, full lint/typecheck/test/build, and Task 2 spec and quality approvals.
- Blocked on: nothing.
- Next step: commit and push Task 2, then deploy the exact commit as an owner-only Sites version for live capability verification.

## ResumeStateHint

Read `10-intent.md`, this checkpoint, `GOAL.md`, and `BUILD_INDEX.md`; verify the worktree, branch, and Git status before resuming. Never resume from chat memory alone.

## DriftCheckDraft

- Intent: aligned.
- Scope: aligned with Task 2 and the launch goal.
- Compatibility: web-standard MCP transport keeps Worker/Vercel fallback viable; the Sites MCP route remains a truthful 501 until live support is proven.
- New owner/fallback: external MCP topology is prepared but not production-selected until live deployment evidence exists.
- Evidence sufficiency: direct migration, real D1, smoke, lint, typecheck, test, build, and both required reviews pass locally; production evidence remains separate.
- Decision: continue.
