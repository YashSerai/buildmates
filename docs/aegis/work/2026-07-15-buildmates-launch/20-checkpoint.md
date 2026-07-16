# Buildmates Launch Checkpoint

Updated: 2026-07-16, production website-to-plugin identity bridge complete
Status: active

## TodoCheckpointDraft

- Current todo: perform focused authenticated product QA, then run the security, copy/material, and final Folk-inspired UI/UX audits.
- Active slice: Task 5 final quality findings repaired and locally verified: fail-closed subject-backed Surface briefs, Sites-native authenticated administrator recovery, same-origin link mutations, global-only public MCP scope, the link-code rate-limit index, bounded direct pagination and taxonomy queries, indexed expiry cleanup, authenticated connection setup, follow/watch adapter parity, and shared canonical hashing; independent rereview pending.
- Completed todos: Tasks 1-3; Task 4 candidate and all review repairs, including themed state shells, guaranteed two-tone focus, populated-safe historical policy backfill, a versioned parser/policy registry that preserves `.1` reads under active `.2`, srcdoc breakout defenses, iterative deep-input preflight, streaming upload caps, non-destructive object handling, no-store asset revocation, bounded indexed asset lookup, and removal of current font upload support.
- Evidence refs: `GOAL.md`, canonical specs and plan, GitHub remote, `docs/evidence/sites-capability-gate.md`, migrations 0000-0013, 30 focused final-finding tests, 60 unit tests, 29 integration tests, 26 MCP contract tests, 10 desktop/phone E2E tests, fresh/populated D1 migration output, and local lint/typecheck/build.
- Blocked on: no single-account implementation blocker. A second independent identity remains necessary only for irreducible two-user production acceptance and authorization proof.
- Next step: perform focused authenticated browser QA without repeating broad local suites, then close the launch audits in their recorded order.

## Production identity and hostname migration — 2026-07-16

- Public web production moved to `https://buildmates.yashns.chatgpt.site` in Sites project `appgprj_6a593e7af2388191af07670cf0b503b4`, version 1, from exact pushed commit `827527d03c9730ca900326b9890fa9eb3429bd4d`.
- GitHub OAuth completed in Chrome against the exact production callback. The server verified GitHub's numeric account subject, created a random internal Buildmates UUID, issued the revocable `__Host-` session, and rendered authenticated account, capability, and Codex-connection settings pages.
- A direct request with forged `oai-authenticated-*` headers remained signed out and was redirected to GitHub OAuth. These headers are no longer an application authorization input.
- The authenticated Site created a D1-backed ten-minute, hashed, single-use MCP link code. The connected Buildmates plugin consumed it once, resolved the same account, and read the canonical setup state: 1 of 11 steps complete, with storage acknowledgment next.
- The retired `buildmates-network` Site inventory contained zero users, sessions, identity links/codes, profiles, projects, Work Signals, matches, Connections, rooms, messages, Circles, or R2 objects. Only migration metadata and the seeded design policy existed, so no user-created data required transfer.
- The old Sites project was permanently deleted after inventory and replacement verification. The old URL returns 404; the replacement returns 200 and remains public.

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

## Codex-first onboarding contract - 2026-07-16

- Codex is now the canonical first-run controller in the product spec, architecture, plugin manifest, and onboarding skill. Install, setup, start, or resume requests begin with `get_setup_state` and advance one ordered step at a time rather than presenting an ambiguous product menu.
- The website `/onboarding` route reads the same D1 setup state and directs the user back to the registered Buildmates app with an exact prompt. It explains the GitHub website-identity boundary and approved-summary storage boundary without implying repository or connector access.
- The existing complete 11-step website flow moved to `/onboarding/manual` as an explicit fallback. Profile publishing, discovery, chats, rooms, privacy, and settings remain website responsibilities.
- Plugin version `0.3.0+codex.20260716211905` validates, the web workspace typechecks, and `git diff --check` passes. Rendered browser proof is intentionally deferred to the batched UI/UX gate.

## Security pass repair checkpoint - 2026-07-16

- Browser mutations now require exact same-origin requests across project creation, Surface uploads, and capability diagnostics. Viewer-dependent profile and project reads use private no-store caching, deleted identities cannot be relinked, synthetic sessions require a local-only Cloudflare runtime binding, and the temporary migration manifest is removed.
- Account deletion is a two-phase, idempotent operation. Access is revoked and personal data is scrubbed transactionally before R2 deletion; an administrator-only same-origin recovery endpoint can resume a stale deleting job after transient asset-storage failure. Repeated and concurrent recovery produces one completion audit event.
- Deletion now removes owned project links/media/taxonomy, generated Surfaces and revisions, relationship snapshots/context, scheduling records, and authored room/Circle payloads. Moderation decisions and content-free integrity records may remain; report details and appeal statements are redacted under the documented retention rule.
- The account export now includes identity-link metadata without secrets, sessions without token hashes, networking controls, growth records, generated Surfaces/assets, match decisions, relationship reminders, room/Circle participation, scheduling, notifications, automation, safety records, and lifecycle state in addition to the original profile/project/signal data.
- Focused proof: account-deletion integration passes 2/2 including R2 failure/recovery/concurrency and sentinel removal; privacy export runs successfully through the real authenticated route in Chromium; web typecheck and production build pass. Central API error allowlisting and nonce CSP remain post-launch hardening because user responses already suppress 500-level internals and the current Sites/Vinext runtime requires inline framework bootstrap.

## Copy and UI/UX audit repair checkpoint - 2026-07-16

- Discovery now leads with current work, topic, stage, and coarse location. Optional challenge/share/value signals and secondary filters live under an accessible disclosure, so the product no longer presents needs and offers as prerequisites for connection.
- Internal builder UUID exclusions and the unprocessed queued-export control are removed from user-facing flows. Immediate authenticated export remains the supported path. Full Autopilot, raw-context storage, inbox timing, background actions, and identity-linking copy now match the implemented product boundaries.
- Published generated profiles keep trusted navigation and real follow/edit/redesign actions outside generated authority. Preview-only Surface action rows are omitted unless a trusted action handler exists.
- Existing profiles now load into the profile editor with their current audiences, fields, statistics, matching choice, location controls, and introduction mode instead of opening a blank replacement form.
- Profile and room redesign now lead with a Codex handoff that names the governed Surface and required workflow. Raw generation briefs and SurfaceSpec JSON remain available only under Advanced as a universal fallback.
- Account deletion now redirects to a terminal signed-out confirmation surface. Global loading/error states use the Buildmates shell and provide a stable recovery path. Primary controls use a 44px minimum and the shared typography stack no longer defaults to Arial or overrides generated corner tokens.
- Focused evidence: web and MCP-core typechecks pass; the production web build passes; affected profile/discovery/privacy Playwright coverage passes on desktop and phone after stale expectations were updated. The first 16-test batch had 12 passing and four expectation-only failures caused by superseded copy/export behavior; the exact four reruns pass.
- Production deployment: exact pushed commit `5585b2760d9f05a5542965e1585609d2105dfbef` is public as ChatGPT Sites version 2 at `https://buildmates.yashns.chatgpt.site`. The post-deploy smoke passes the public landing, D1 readiness, security headers, authenticated redirect boundary, launch metadata, and external MCP OAuth boundary. Live authenticated one-account and two-account interpersonal browser flows remain separate evidence gates; this deployment does not claim they were re-run.

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
