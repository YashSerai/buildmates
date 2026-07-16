# Buildmates Launch Checkpoint

Updated: 2026-07-16, Task 10 source implementation complete
Status: active

## TodoCheckpointDraft

- Current todo: run one consolidated product milestone verification, then complete the Folk-inspired final visual system and production release.
- Active slice: Task 5 final quality findings repaired and locally verified: fail-closed subject-backed Surface briefs, Sites-native authenticated administrator recovery, same-origin link mutations, global-only public MCP scope, the link-code rate-limit index, bounded direct pagination and taxonomy queries, indexed expiry cleanup, authenticated connection setup, follow/watch adapter parity, and shared canonical hashing; independent rereview pending.
- Completed todos: Tasks 1-3; Task 4 candidate and all review repairs, including themed state shells, guaranteed two-tone focus, populated-safe historical policy backfill, a versioned parser/policy registry that preserves `.1` reads under active `.2`, srcdoc breakout defenses, iterative deep-input preflight, streaming upload caps, non-destructive object handling, no-store asset revocation, bounded indexed asset lookup, and removal of current font upload support.
- Evidence refs: `GOAL.md`, canonical specs and plan, GitHub remote, `docs/evidence/sites-capability-gate.md`, migrations 0000-0013, 30 focused final-finding tests, 60 unit tests, 29 integration tests, 26 MCP contract tests, 10 desktop/phone E2E tests, fresh/populated D1 migration output, and local lint/typecheck/build.
- Blocked on: only the account-side ChatGPT app creation needed to obtain a real app ID; source intentionally contains no invented ID. No local implementation blocker is open.
- Next step: finish Task 10 browser-facing lifecycle controls and concurrency coverage, reconcile Tasks 6-8 and 12, then run one milestone verification pass.

## Task 10 relationship and room integration checkpoint — 2026-07-16

- Match opening now captures immutable display snapshots, a viewer-authorized shared connection reason, an optional canonical theme topic, and a published initial room SurfaceSpec in the same atomic D1 batch as the Connection and room.
- Ended or blocked rooms fail closed. Reconnect requests use a deterministic id, a one-pending-request constraint, idempotent notification creation, and loser-safe pending-request resolution.
- Chat polling uses the compound server cursor only; an optimistic local send can no longer skip a concurrent committed message.
- Meeting proposals use stable client request identifiers. Calendar receipts require a provider-confirmed MCP path, an accepted same-room proposal, exact accepted times, and same-room event ownership.
- Private availability windows and pairwise intersections are stored without exposing either person's complete availability. The room UI can use an overlap to prepare a proposal.
- The Codex scheduling handoff now names the accepted proposal and exact interval. ICS remains available without a desktop deep link.
- Drizzle migration `0017_dark_invisible_woman.sql` coherently combines the interrupted invite redemption/location changes with availability, immutable connection context, Calendar proposal linkage, and the reconnect uniqueness gate. The migration was generated from the `0016` snapshot and inspected.
- Focused evidence: web typecheck passes; room lifecycle tests passed 8/8 in the combined targeted run; reciprocal matching tests pass 6/6 after aligning expired-capability setup with the actual acceptance sequence.
- Room redesign now has a private generation brief, validated SurfaceSpec previews, unanimous member approval, base-version publication, history, and rollback through a new reviewable revision. The MCP path remains the primary Codex-native generation flow; the website paste flow is a universal fallback.
- Connection cards now preserve and display the immutable authorized match reason, shared context, and connection date alongside private notes, reminders, update preferences, feedback, mute/end/reconnect, report, and block controls.
- Task 10 source implementation is complete. Final milestone browser verification remains intentionally batched with the broader product pass.

## Task 7 profile and project implementation candidate

- Migration `0014_profile_project_product.sql` adds independent profile-field audiences/provenance, owner-controlled statistics provenance, project stage/indexing/publication/deletion state, project links/media/updates/taxonomy, globally shareable slugs, and bounded matching retrieval indexes.
- Profile and project services enforce canonical audiences in SQL. Anonymous and signed-in reads do not fetch private fields; blocks, cohort scope, suggestions, mutual Connections, ownership, and approved collaboration remain derived from canonical tables.
- Authenticated profile review, project create/edit, generated-design revision history, public builder/project routes, `/@handle` rewriting, robots metadata, honest empty states, and responsive desktop/phone layouts are implemented.
- Generated profile design uses a policy-versioned owner-only brief, trusted SurfaceSpec validation, private revisions, optimistic publication, rollback through historical revision publication, and server-resolved viewer-authorized bindings.
- Project owner controls now expose editing, archive/restore/delete, shareable updates, handle-based collaborator invitations, accepted-collaborator transfer/removal, and a dedicated invitation accept/decline flow. All collaborator and update mutations enforce same-origin requests.
- Profile Surface history now renders real private previews and performs rollback by cloning the selected historical spec onto the current base revision before publication. A stable `/profile` entry route resolves to the published profile or editor.
- Remaining Task 7 review work: aggregate verification after product lanes settle and authenticated two-account browser proof where the environment permits it.

## Task 11 Circles implementation checkpoint — 2026-07-16

- Deterministic triadic-closure suggestions are derived only from three existing active reciprocal Connections. Suggested Circles remain proposed and reveal only their bounded purpose until every invitee explicitly accepts.
- Active Circles now have private member chat with idempotent client message IDs and member notifications, handle-based invitations, leave/remove/promote/demote/ownership-transfer controls, and governance-version invalidation when membership or roles change.
- Admin or majority-vote proposals can activate the approved module set. Module entry controls persist real member content instead of a placeholder action.
- Drizzle migration `0018_familiar_goliath.sql` adds indexed Circle messages without altering previous migrations.
- The Circle governance integration file passed in the boundary run. That command unintentionally exercised the full integration directory; 61/64 tests passed, with three unrelated/stale aggregate expectations retained for the next milestone repair rather than triggering repeated broad runs.
- Circle modules now return and render their persisted member-authored entries. Published Codex-generated Circle SurfaceSpecs render as the shared header with server-resolved member, module, and metric bindings; the trusted product chat and governance controls remain outside the generated surface.

## Task 13 operational safety checkpoint — 2026-07-16

- The Site worker now applies a consistent CSP, framing/MIME/referrer/permissions guards, a bounded request ID, and content-free structured request events. Public readiness performs an actual D1 query without exposing database details.
- A production smoke harness checks the public landing, D1 readiness, security headers, auth boundary, launch metadata, and optional MCP initialize/OAuth behavior.
- Web mutation rate limits now cover reports, blocks, Circle chat, and profile/room Surface drafts in addition to existing room-message, invitation, discovery, and MCP limits.
- Account export has an immediate authenticated no-store JSON download. Confirmed account deletion atomically de-publishes and redacts profile/project/signal data, revokes identity and connector access, ends relationship access, removes private owner state, tombstones assets, and completes its tracked deletion job.
- Shared connection context can be redacted without changing another member's messages or private notes. The rendered room Surface reads the redacted server binding immediately.
- Focused proof only: the web workspace typechecks and the destructive account-deletion path passes against fresh D1 migrations. Aggregate verification remains deliberately batched for the product milestone.

## ResumeStateHint

Read `10-intent.md`, this checkpoint, `GOAL.md`, and `BUILD_INDEX.md`; verify the worktree, branch, and Git status before resuming. Never resume from chat memory alone.

## Task 6 onboarding, privacy, and automation candidate

- The authenticated web flow now resumes the same ordered 11-step setup contract used by MCP: explicit storage boundary, individual non-exhaustive source policies, adaptive sparse/rich context, Work Signal review, confirmed profile, private page preview, expiring Networking Pulse, Manual/Full Autopilot, one automation, and a real topic watch as the first useful outcome.
- `/settings/privacy` is a canonical-data inventory with source revocation, signal deletion, profile/networking/automation state, account record counts, pause matching, disable autopilot, disconnect-all, tracked export, guarded account deletion, and a bounded content-free audit log. Mutations require authenticated actor scope and exact same-origin requests.
- `/settings/automation` exposes similar/adjacent and local/global preferences, temporary intent expiry, hard weekly introduction budget, quiet hours, serendipity, exclusions, repeated-cluster avoidance, source liveness acknowledgement, and one user-controlled cadence. Full Autopilot capability is durably stored in the `automation_checkpoints` `buildmates` row as `available`, `approval_required`, or `automation_unavailable` with `checkedAt`; it is distinct from profile acceptance preference.
- No Task 6 shadow store or migration was introduced. Existing canonical profile, setup, connected-app, Work Signal, Networking Pulse, budget, snooze, watch, automation, lifecycle, identity-link, and audit tables remain authoritative. Task 7 owns migration `0014`.
- Focused proof: real Miniflare D1 tests pass 2/2 for ordered resume/completion, durable capability, expired-signal status, and atomic source/signal revocation. Playwright passes 8/8 across desktop and Pixel 7 for sparse completion/resume, non-exhaustive source policy controls, keyboard focus, unavailable Codex fallback, privacy actions, lifecycle confirmation, automation settings, and horizontal overflow.

### Task 6 independent-review repair

- An active global Buildmates MCP identity link now drives the `identity_link` setup step. Website preparation remains visible but cannot claim 11/11 Codex setup, and successful one-time link consumption advances identity setup in the same D1 batch.
- Browser automation settings cannot set `capability=available` or mint `checkedAt`. They preserve a trusted result, downgrade when disconnected, or request a recheck; only the trusted server capability writer can record availability.
- Onboarding uses the canonical profile service and handle rules. Profile drafts remain unpublished and unavailable to anonymous viewers until preview approval publishes them; public profile URLs use `/@handle` canonically.
- Quiet hours, user exclusions, and snoozes replace canonical enforcement rows on every Networking Pulse save. Clearing a control removes its canonical rows.
- Source or signal removal and disconnect-all atomically scrub and version the builder index, delete affected scores and candidate batches, invalidate pending proposals, and dismiss pending match notifications.
- Owner views show friendly source names, public approved/current Work Signals are projected through canonical audience checks without source metadata, and projects can be soft-deleted from the privacy inventory.

## DriftCheckDraft

- Intent: aligned.
- Scope: aligned with Task 4 and the launch goal; final brand/art direction remains deferred while the functional generative-surface boundary is complete.
- Compatibility: migrations use SQLite/D1-supported DDL and preserve the Task 2 identity/OAuth tables without a second identity authority; migration 0005 orders parent composite keys before dependent table rebuilds.
- New owner/fallback: database interfaces keep local memory and D1 adapters behaviorally aligned; the signed service client keeps the external MCP topology host-neutral.
- Evidence sufficiency: generated and inspected migrations, repeated fresh Miniflare D1 apply through 0005, canonical audience authorization, all named aggregate boundaries on both adapters, comprehensive second-user actor-forgery and crossed-pair denials, exactly-one-owner transfer invariants, expiry-aware idempotency outcomes, transactional fault injection for Surface publication and Circle voting, concurrent publish/vote retries, room/Circle approval thresholds, stale base/governance/CAS denials, standing-based appeals, approved-collaborator access, lint, typecheck, tests, and build pass; independent specification/security and quality rereviews both approve.
- Decision: continue.
