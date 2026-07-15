# Buildmates Build Index

Status: one-shot launch execution in progress  
Last updated: 2026-07-15  
Product line: Meet people through what you build.

## Read order

1. `GOAL.md` — terminal outcome, autonomy, fallback authority, and the meaning of `go`.
2. `BUILD_INDEX.md` — current scope, execution policy, and next action.
3. `docs/aegis/specs/2026-07-14-buildmates-product-design.md` — canonical product specification.
4. `docs/aegis/specs/2026-07-14-buildmates-architecture.md` — canonical deployment, identity, data, matching, security, and launch-validation architecture.
5. `docs/aegis/plans/2026-07-14-buildmates-one-shot.md` — implementation sequence, ownership lanes, and verification commands.
6. `docs/aegis/baseline/2026-07-14-initial-baseline.md` — verified starting state and external constraints.
7. `docs/aegis/BASELINE-GOVERNANCE.md` — how facts and scope changes are accepted.
8. `C:\Users\yashs\.codex\guides\anti-slop-design-law.md` — canonical design-quality law.

If these files conflict, the product specification wins for intended behavior, this index wins for current execution status, and verified runtime evidence wins for what actually works.

## Product thesis

Buildmates is a Codex-native builder network that introduces people through current work rather than static credentials. A user permits Codex to summarize selected connected-app context into privacy-safe Work Signals. Buildmates uses deterministic retrieval plus two independent user-side Codex evaluations to form mutually relevant matches. Depending on each person's acceptance mode, reciprocal approval opens a lightweight, context-themed room. Connections can remain simple relationships or later grow into richer Codex-generated workspaces and Circles.

## Non-negotiable product rules

- Buildmates is the only required plugin. Other connected apps remain optional sources governed by host permissions plus individual Buildmates source-use policies; generic installed-app enumeration is not assumed.
- First run has a mandatory resumable outcome and supports sparse context through adaptive questions, manual input, one selected project/repository, pasted description, and portfolio links.
- Buildmates never receives third-party connector credentials or raw conversation history.
- Web and MCP identities never join by email/name. The only pre-link MCP write atomically consumes a short-lived code; external MCP requests delegate a signed OAuth subject, never a caller-supplied internal user ID.
- Raw prompts, full documents, private repositories, email bodies, and calendar contents are not persisted as Work Signals.
- Day-one server-side matching uses no paid model inference and requires no vector embeddings.
- Work Signals use a versioned canonical taxonomy, and candidate retrieval reads a denormalized builder match index plus reproducible pair-score rows.
- The deterministic backend supplies each automation only the top 20–30 viewer-authorized candidates; that user's Codex performs the private final evaluation and selection.
- Pair scores bind both builder-index versions plus taxonomy/weight versions, and retrieval rejects stale, expired, blocked, paused, or newly hidden evidence.
- Matching optimizes for mutual relevance across work, interests, ambitions, stage, communities, and location; asks and offers are optional signals.
- A user automation can evaluate matches for that user; the server never impersonates the other person.
- Manual and Full Autopilot acceptance are explicit per-user settings.
- Full Autopilot is available only after a per-user unattended-write capability check; otherwise the product shows approval-required or automation-unavailable and never claims the room opened automatically.
- A new room is a themed lightweight chat, not an immediate dashboard.
- Room upgrades are offered after useful conversations and require consent.
- Generative UI is data-driven and versioned; it does not require a deployment per profile or room.
- Generated surfaces use approved primitives plus sanitized, scoped HTML/CSS. Arbitrary generated JavaScript is excluded from day one.
- Trusted component trees are the primary SurfaceSpec structure; free-form HTML/CSS is decorative/editorial only and runs in a credentialless sandbox.
- Shared redesigns use preview, approval, version history, rollback, and optimistic concurrency checks.
- Circle roles are stored and enforced server-side. The creator begins as owner/admin and can promote, transfer, or remove admins.
- Anti-slop, accessibility, privacy, and surface-governance rules are versioned as a runtime Design Policy and included in every generation brief.
- ChatGPT Sites is the first web host. Web and MCP are separate monorepo deployment units; MCP co-deploys only if verified, otherwise it moves to a Worker or Vercel behind the same contract. Portability boundaries keep migration bounded to identity, data, assets, notifications, MCP exposure, and deployment adapters rather than domain behavior.
- The first complete release uses a clean neutral UI with finished flows, responsive behavior, accessibility, and all product states; final brand and visual art direction begin only after that production gate.

## Feature ledger

| Area | Day-one behavior | Later expansion | Status |
|---|---|---|---|
| Landing and identity | Public explanation, Sign in with ChatGPT, mobile web access | Custom domains and organization identity | Planned |
| Agentic first run | Visible setup progress, rich/sparse context branches, privacy/profile preview, preferences, automation, first useful outcome | Smarter adaptive questioning | Planned |
| Connected apps | Present identified, declared optional, or user-named sources with one Buildmates policy per source; the list is explicitly non-exhaustive | Source-specific policies and admin presets | Planned |
| Work Pulse | Scheduled or manual extraction of approved Work Signals | Smarter cadence and stale-signal cleanup | Planned |
| Networking Pulse | Expiring intention, similar/adjacent, local/global, intro budget, quiet hours, snooze, serendipity, exclusions | Learned preference suggestions | Planned |
| Profiles | Profile review, field-level visibility, projects, generative responsive surface, optional connection/build stats | Broader module library and isolated custom code | Planned |
| Projects | Create/edit/publish/archive/delete/transfer, collaborators, visibility, matching permission, update history, canonical sharing | Richer project modules and team workflows | Planned |
| Cold start and growth | Shareable profiles/projects/cards, personal and cohort invites, follows, watches, honest no-match state | Referral analytics and organization invitations | Planned |
| Discovery | Search, cohort pages, project/topic follows, build graph, geographic globe | Richer filters and graph exploration | Planned |
| Matching | Deterministic shortlist, independent Codex evaluations, reciprocal handshake | Optional embeddings only after measured need | Planned |
| Acceptance | Manual or Full Autopilot modes | Per-context acceptance rules | Planned |
| Rooms | Mutual-interest lightweight chat themed around the connection reason | Consent-based room upgrade modules | Planned |
| Connections | Persistent mutual relationship, why/when met, private notes, reminders, updates, mute/end | Longitudinal relationship intelligence | Planned |
| Intro memory | Private structured feedback and match-preference learning | Longitudinal relationship health | Planned |
| Scheduling | Calendar-aware suggestions through permitted apps and ICS fallback | More scheduling connectors | Planned |
| Cohorts | Public/request/invite/private membership, owner/admin roles, invites, join approval, transfer, archive/delete | Organization tooling | Planned |
| Circles | Triadic-closure suggestion, group chat, creator-admin governance | Voting, trackers, custom leaderboards, shipping rooms | Planned |
| Generative UI governance | Private preview, approvals, history, rollback, base-version check | Sandboxed interactive code | Planned |
| Privacy and safety | Canonical visibility, source ledger, block/redaction, export/delete, audit trail | Organization policy tooling | Planned |
| Moderation | Restricted operator queue, report status, enforcement, impersonation/safety reasons, appeal/review | Cohort-admin delegation | Planned |
| Notifications | Immediate in-app product events plus one Codex automation for intelligence refreshes and digests | External email adapter if required | Planned |
| Product validation | Reproducible multi-user flow plus genuine connected-context onboarding on phone and desktop | Broader beta cohorts and production analytics | Planned |

## Continuous launch validation

These checks are part of one continuous implementation run. They produce evidence and select fallbacks; they are not handoff points where execution returns to the user:

1. Deploy nested `apps/web` as a public ChatGPT Site; prove anonymous non-owner reachability, shared-workspace resolution, D1, and R2.
2. Prove a stable public-user subject; use GitHub OAuth only when the Site is reachable but SIWC auth/subject behavior fails.
3. Prove private object authorization between two users using a minimal capability record.
4. Select and prove the thin Sites or external MCP topology, OAuth 2.1/PKCE, and the signed subject-resolving internal boundary when external.
5. Link web and MCP identities using an OAuth-only pre-link operation and a compare-and-set consumed single-use code.
6. Connect the plugin from a clean external-style account.
7. Submit a real Work Signal from a Codex session.
8. Run an unattended automation that calls Buildmates.
9. Classify and persist consequential-write capability.
10. Atomically create one Connection and room under concurrent requests.
11. Publish and roll back a SurfaceSpec.
12. Test two-session message polling.
13. Test optional `codex://` handoff plus copy/manual fallback.
14. Test Calendar capabilities and activate ICS fallback when unavailable.

Every check records evidence. Failures trigger diagnosis, repair, or the documented adapter fallback, and implementation continues. Release waits until checks 1–12 pass under the selected production topology; deep-link and Calendar checks may resolve through their documented fallbacks. Only an irreducible human/account action may interrupt the run. Domain behavior must not silently fork across platforms.

## Execution lanes

- Primary integration: architecture, schema ownership, merge gates, security, and final release.
- ChatGPT Sites capability and identity: deployment, public-user auth, D1/R2, explicit MCP identity linking, and separate-MCP fallback.
- Product data and matching: Work Signals, deterministic retrieval, reciprocal state machine, evaluation fixtures.
- Plugin and automation: onboarding, app permissions, MCP tools, scheduled Work Pulse.
- Generative surfaces: SurfaceSpec renderer, Design Policy, profile/room/Circle revision workflows.
- Product UI: landing, onboarding, discovery, profiles, rooms, Circles, privacy, responsive polish.
- QA and release: accessibility, mobile/desktop evidence, attack cases, reproducible fixtures, operator docs, GitHub, and production deployment.

Subagents work in bounded lanes. The primary thread owns shared contracts and integration. A lane does not change another lane's contract without updating the specification and build index first.

## Definition of done

Buildmates is not complete when screens merely render. Completion requires:

- the end-to-end two-user product flow works with independent identities;
- a user in a sparse network can publish, invite, follow, watch, explore, and receive a truthful no-match state;
- every opened room has one persistent Connection with isolated private notes and mute/end/reconnect behavior;
- all four Manual/Full Autopilot combinations preserve two independent Codex evaluations;
- Full Autopilot capability/fallback and hosted-versus-local source liveness states are truthful;
- all visible controls perform a real action or are absent;
- privacy decisions affect stored and rendered data;
- reciprocal matching cannot be bypassed by one automation;
- room and Circle authorization is enforced on the server;
- generated surfaces survive malformed input and remain accessible;
- desktop and phone paths are visually inspected;
- tests, lint, type checks, migrations, and production smoke checks pass;
- source-control, deployment, and live-runtime truth are reported separately;
- the repository, deployment, operator documentation, and production verification are complete.

## Current next action

Execute Task 1, establish the isolated implementation branch and long-task checkpoint, then continue through Tasks 2–14 without returning at internal milestones.
