# Buildmates Build Index

Status: Release candidate deployed; visualization density fixture is live for visual approval, then clean onboarding and two-person QA remain
Last updated: 2026-07-18
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
- Codex is the canonical first-run controller: installation immediately resumes the mandatory setup state machine and directs the user through one concrete next step at a time. The website shares that D1-backed progress, owns identity linking/profile publishing/chat surfaces, and keeps full manual onboarding as an explicit fallback.
- First run has a mandatory resumable outcome and supports sparse context through adaptive questions, manual input, one selected project/repository, pasted description, and portfolio links.
- Buildmates never receives third-party connector credentials or raw conversation history.
- GitHub OAuth is the website login for the launch release. A verified GitHub numeric account ID is mapped server-side to a random Buildmates UUID; that UUID, never login, email, display name, or a deterministic provider hash, owns product data. ChatGPT/Codex connects separately through MCP OAuth and the existing single-use identity-link flow.
- Web and MCP identities never join by email/name. The only pre-link MCP write atomically consumes a short-lived code; external MCP requests delegate a signed OAuth subject, never a caller-supplied internal user ID.
- A revoked or deleted ChatGPT principal cannot silently recreate or reactivate its former Buildmates account.
- Raw prompts, full documents, private repositories, email bodies, and calendar contents are not persisted as Work Signals.
- Work Signals are matching-private records only. They are never publicly searchable; public current-work sharing is a separate explicit profile or project-update publication.
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
| Landing and identity | Public explanation, GitHub OAuth, random internal Buildmates UUID, mobile web access, explicit ChatGPT/Codex connection | Organization identity | Source regression and build pass; current release production proof pending |
| Agentic first run | Visible 10-step setup, rich/sparse context branches, privacy/profile preview, preferences, and automation | Smarter adaptive questioning | Completion ends after automation; optional referral follows setup rather than gating it |
| Connected apps | Present identified, declared optional, or user-named sources with one Buildmates policy per source; the list is explicitly non-exhaustive | Source-specific policies and admin presets | Implemented; live connector proof pending |
| Work Pulse | Scheduled or manual extraction of approved Work Signals | Smarter cadence and stale-signal cleanup | Implemented; unattended production proof pending |
| Networking Pulse | Expiring intention, similar/adjacent, local/global, intro budget, quiet hours, snooze, serendipity, exclusions | Learned preference suggestions | Implemented; D1 integration and desktop/phone settings QA pass |
| Profiles | Profile review, field-level visibility, projects, generative responsive full-page surface, optional connection/build stats, canonical share link | Broader module library and isolated custom code | SurfaceSpec v2 implemented with five structurally distinct responsive portfolio compositions, governed media, real preview/public parity, and canonical `/builders/{handle}` publication |
| Projects | Create/edit/publish/archive/delete/transfer, collaborators, visibility, matching permission, update history, canonical sharing | Richer project modules and team workflows | Implemented in source; integrated review pending |
| Cold start and growth | Shareable profiles/projects/cards, recipient-specific personal invites, follows, watches, honest no-match state | Referral analytics and organization invitations | Implemented in source; integrated review pending |
| Aggregate network views | No people/database search; MapLibre/OpenFreeMap city bubbles and anonymous canonical-topic bubbles expose counts only, never rosters | Richer aggregate filters after network density is proven | A reversible 36-builder aggregate-only fixture is live; automated privacy/count checks and desktop/phone browser QA pass, while founder visual approval and fixture cleanup remain |
| Matching | Deterministic shortlist, independent Codex evaluations, reciprocal handshake | Optional embeddings only after measured need | Implemented; integrated source regression passed |
| Acceptance | Manual or Full Autopilot modes | Per-context acceptance rules | Implemented; live unattended capability proof pending |
| Rooms | Mutual-interest lightweight chat themed around the connection reason | Consent-based room upgrade modules | Implemented; populated chat, safety, tools, scheduling, and responsive QA pass |
| Connections | Persistent mutual relationship, why/when met, private notes, reminders, updates, mute/end | Longitudinal relationship intelligence | Implemented as the durable people layer with attached rooms; D1 and desktop/phone QA pass |
| Intro memory | Private structured feedback and match-preference learning | Longitudinal relationship health | Implemented; integrated review pending |
| Scheduling | Calendar-aware suggestions through permitted apps and ICS fallback | More scheduling connectors | Implemented in source; live Calendar/deep-link proof pending |
| Cohorts | Deferred from the current product and navigation; dormant domain support remains isolated | Reconsider after Circles and network density are proven | Deferred by product decision |
| Circles | Consent-gated triadic suggestions, group chat, creator-admin governance, roles, voting, Codex-generated shared surfaces, approved modules and member entries | Richer tracker templates and shipping-room analytics | Implemented; governance, chat, invitation, admin, module, and responsive QA pass |
| Generative UI governance | Private preview, approvals, history, rollback, base-version check | Sandboxed interactive code | Implemented; recovery seeds are never revisions or publication candidates, and generated content is limited to authorized bindings/assets and trusted action slots |
| Privacy and safety | Canonical visibility, source ledger, block/shared-context redaction, immediate export, physical R2 deletion, rate limits and audit trail | Organization policy tooling | Implemented; production smoke pending |
| Moderation | Restricted operator queue, report status, enforcement, impersonation/safety reasons, appeal/review | Cohort-admin delegation | Implemented; production operator QA pending |
| Notifications | Immediate in-app product events plus one Codex automation for intelligence refreshes and digests | External email adapter if required | Activity feed implemented with safe presentation, hidden-tab polling pause, and desktop/phone QA; production polling smoke pending |
| Product validation | Reproducible multi-user flow plus genuine connected-context onboarding on phone and desktop | Broader beta cohorts and production analytics | Public smoke complete; authenticated production and separate-account proof pending |

## Network IA, copy, and responsive QA - 2026-07-18

- The signed-in product now uses four distinct relationship states: **Introductions** is the candidate and reciprocal-interest desk; **Connections** is the durable people layer and entry point to one-to-one rooms; **Circles** is the group layer; **Activity** is an action-oriented update feed rather than another messaging surface.
- Introductions refreshes safely while visible, keeps pending reciprocal proposals available to the other person, and suppresses duplicate presentation only for the current viewer. Full Autopilot still converges two independent approvals into exactly one Connection and room.
- Connections, one-to-one rooms, Circles, Circle chat, Activity, all four settings sections, and typed private reporting share the same responsive product shell, working empty/error/loading states, keyboard focus, reduced-motion behavior, and at least 44px touch targets.
- Settings now distinguish saved Work Pulse preferences from a host-confirmed recurring Codex task. Tuesdays and Fridays remain the recommended cadence; manual-only behavior is not presented as the default.
- User-facing copy uses Introductions and Activity consistently, removes fallback/process language from web onboarding, explains actions in product terms, and keeps technical identifiers, schemas, checkpoints, raw payloads, and implementation notes out of ordinary surfaces.
- Final rendered evidence covers populated and empty states at desktop and phone dimensions. The populated end-to-end fixture exercises an introduction, a Connection and room conversation, two Activity items, an active Circle chat, and a Circle invitation without leaking into production.
- Source verification: clean lint and workspace typechecks; 13/13 rendered web assertions; 91/91 unit tests; 82/82 integration tests after SurfaceSpec v2 fixture repair; 35/35 contract assertions after current-time/order fixture repair; 12/12 security tests; production workspace build; 12/12 focused settings/safety desktop-phone checks; and 2/2 final populated-network desktop-phone journeys with zero console errors or horizontal overflow.
- **Still required before launch:** run one clean 0/10 Codex onboarding QA against the deployed release candidate, complete founder visual review of the populated Map and Build Graph, remove the temporary visualization fixture, and run genuine two-person behavior with an independent account.

## Clean-room onboarding QA repair - 2026-07-17

- OAuth guidance announces the GitHub browser handoff, allows a five-minute user-controlled authorization window, and forbids duplicate in-flight launches.
- Onboarding recommends GPT-5.6 Luna High when selectable and operates the MCP directly without recursive `codex exec` helpers.
- Source selection recommends permissioned Codex-workspace review. A private local `.buildmates/profile-context.md` preserves multi-project research across compaction; only the reviewed structured profile is submitted.
- Profile context accepts up to 12,000 characters and the canonical profile stores richer approved fields plus private design/personality preferences.
- An approved private profile satisfies the basic-profile checkpoint. Intended public visibility no longer publishes before generated-page approval.
- Surface generation returns a known-valid starter, exposes the active schema, supports field-level dry-run validation, and keeps the starter as a recovery path.
- Work Signal wording, profile status wording, aggregate-map/indexing explanations, example metrics, and the connection-page first viewport were corrected.
- Remaining brand task: generate the final Buildmates logo with ImageGen and replace the current Buildmates/Codex text labels with approved marks where permitted. No placeholder initials remain.
- Exact source commit `7b93a9b96e0396f7779c5e38da3aec04ed49d00d` is live as ChatGPT Sites version 17 and Worker version `534d8a18-5c4e-4a68-a573-262794948822`. Production returned 200 for `/`, `/install`, `/llms.txt`, OAuth metadata, and protected-resource metadata; unauthenticated MCP access returned 401 as required.
- The production test account reached terminal deletion, external MCP OAuth/principal/handoff/replay/rate-limit state was cleared, and GitHub confirmed the Buildmates OAuth grant was revoked. The next authorization must therefore create a new Buildmates account and begin from the server-authoritative `0/10` state.
- Beta activation now treats the fresh-task boundary as part of installation UX. After installation and OAuth, Codex asks permission to open the activated task itself through the host; only when native task creation is unavailable does it show the exact one-line manual fallback. Recursive `codex exec` is explicitly forbidden. Exact source commit `41766beb26e9fcfbf9d8f21c154cf428991b163a` is live as ChatGPT Sites version 18, and the beta cachebuster is `0.3.0-beta.1+codex.20260717222507`.
- QA task `019f721b-2b85-7c72-8f5c-f0e0b6728887` completed Buildmates OAuth but made no native create-task or fork-task call. It had loaded the pre-version-18 public contract and beta package before the automatic handoff repair was deployed, so it correctly fell back to telling the user to start a fresh task; this was not a failed host task-creation attempt.
- The MCP authorization route now uses a dedicated consent surface with a compact Codex-to-Buildmates handoff diagram, plain-language permissions, explicit expired-link recovery, a working signed-out path, responsive layout, reduced-motion support, and `noindex` metadata. Exact source commit `feb9e04b4bd5397223c5fed0475600e2524e7806` is live as ChatGPT Sites version 19 (`appgdep_6a5ab28641e88191b642ad2afc763a11`).
- After QA task `019f7229-c56b-7a33-8718-f31e1ac7f2bb` exposed a stale beta snapshot and a pre-auth task-registry freeze, the local Buildmates plugin, MCP registration, and MCP OAuth credential were removed. The `buildmates-beta` marketplace was refreshed successfully and now exposes `0.3.0-beta.1+codex.20260717222507`; Buildmates remains intentionally uninstalled so the next QA exercises the public acquisition flow from its first prompt.

## Continuous launch validation

These checks are part of one continuous implementation run. They produce evidence and select fallbacks; they are not handoff points where execution returns to the user:

1. Deploy nested `apps/web` as a public ChatGPT Site; prove anonymous non-owner reachability, shared-workspace resolution, D1, and R2.
2. Prove the app-owned GitHub OAuth callback, map the verified numeric GitHub subject to a random internal Buildmates UUID, and ignore all caller-supplied `oai-authenticated-*` headers for application authorization.
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

## Functionality findings repaired 2026-07-16

All findings below were implemented and regression-tested. The integrated source gate passes lint, type checks, unit, integration, contract, security, rendered-output, plugin validation, and every workspace production build. Production remains the prior release until the later deploy gate.

- **Repaired; focused contracts passing:** MCP candidate retrieval now creates or resumes an authorized bounded batch and returns safe evaluation context plus existing proposal identifiers.
- **Repaired; focused contracts passing:** MCP evaluations and manual responses now invoke the canonical reciprocal state machine, including decline handling, Full Autopilot, budgets, notifications, and atomic Connection/room creation.
- **Repaired; focused Circle suite passing:** new Circles create a governed Surface; design proposals create real private revisions and publish through stored admin/vote governance; approved module rules persist immutable version history.
- **Repaired; focused Circle and room suites passing:** approved modules expose validated entry create/update/delete behavior with member, author, and admin authorization plus working room/Circle UI.
- **Repaired; focused contracts passing:** project create/edit exposes active canonical topics, tools, and domains; the server rejects missing or retired taxonomy identifiers before they can affect matching or the Build Graph.
- **Repaired; focused contracts passing:** builder/connection-card invites require and persist an owned target plus headline; follows validate visible, unblocked targets and the relevant-builder watch is honestly one global `network` watch.
- **Repaired; focused contract passing:** ending a Connection through MCP now ends its active room in the same D1 batch as the Connection state change.
- **Repaired; focused contract passing:** website and MCP use one `buildmates` automation checkpoint, preserve trusted capability evidence, and round-trip Automatic/manual cadence plus source-liveness review.
- **Repaired; focused contract passing:** Calendar handoff now returns authorized room participants, time zones, real shared availability intersections, and a topic-aware agenda; ended rooms fail closed while Codex, copy, manual time, and ICS options remain available.
- **Repaired; room suite passing:** ICS export requires an accepted proposal and active room membership; arbitrary timestamps cannot create calendar files. Accepted/provider-confirmed schedule state is visible in the room.
- **Repaired; room suite passing:** Connection mute suppresses recipient message, meeting, upgrade, and reconnect alerts without blocking the underlying authorized actions; inbox per-item/mark-all controls report failures and link to stable destinations.
- **Repaired; rendered UI passing:** personal invitations infer the sender from the authenticated Buildmates session and create a single-use link without asking for a username. Relevant-builder watches explicitly report through the next scheduled Work Pulse task result rather than implying an instant background notification.

## Copy and UI/UX gate passed 2026-07-16

- Product-wide copy was reviewed for user-facing language, truthful capability boundaries, consistent labels, empty/error/loading states, and removal of internal implementation phrasing.
- The responsive product shell now exposes the core network surfaces consistently on desktop and phone. Every retained navigation item routes to implemented behavior.
- The public landing page, aggregate MapLibre city view, Build Graph, onboarding, profile editing/design/publishing, matches, Connections, Circles, inbox, invitations, and privacy settings were rendered and inspected at phone and desktop sizes.
- The final visual system uses warm paper, dark moss, leaf green, and orange with editorial type scale and the three-stage signal-to-room trail. Folk informed hierarchy and compactness without copying its identity.
- Accessibility repairs include a skip link, visible focus treatment, semantic labels and live regions, full-opacity read notifications, non-color status cues, keyboard-operable menus, honest sparse states, and reduced-motion-safe content visibility.
- Retained evidence is under `docs/evidence/ui-audit/2026-07-16/`. Source verification passes lint, all workspace typechecks, production build, rendered web 10/10, unit 80/80, integration 77/77 across the full run plus the isolated timeout rerun, contract 30/30, security 12/12, and `git diff --check`.

### Corrective frontend audit 2026-07-16

- Rejected internal-facing copy such as “A map without the pin drop,” aggregate-policy narration, matching-state mechanics, and account-link implementation language was removed from public and everyday product surfaces. Technical terminology remains only where it is necessary to control privacy or operate the system.
- The landing page was restored to the approved left-story/right-sequence composition. Display sizes, section height, dashboard gaps, map/graph height, footer space, onboarding progress, and generated-surface headings were reduced to prevent oversized type and dead space.
- Responsive corrections cover the 320px public header, the signed-in menu collapse, mobile onboarding progress, populated match actions, Circle heading actions, city rows, generated Surface headings, and long content overflow.
- Render evidence was recaptured at 1440x900, 390x844, and 320x700. DOM checks confirm no horizontal overflow on landing, Map, Build Graph, Privacy, and Install at the tested widths. Focused phone suites pass: public discovery 5/5, matches/inbox/connections 3/3, onboarding 3/3, and profile/project forms 2/2.
- The audit found and fixed duplicated metadata suffixes such as “Matches | Buildmates | Buildmates” across network, onboarding, settings, safety, and Circle pages.
- Current source gates after the corrective pass: root lint, web typecheck, web production build, and `git diff --check` pass. ChatGPT Sites version 5 is live from exact commit `57dce1e67d98b4acd1b45a21d0820138e182b52b`; public landing, D1 readiness, security headers, authenticated-route boundary, robots/manifest, external MCP OAuth boundary, and rendered 1440/390/320 overflow checks pass in production.

## Security and privacy findings repaired 2026-07-16

- MCP authorization assertions are bound to the initiating one-time handoff, and the short-lived authorization cookie is bound to the exact OAuth request; sensitive redirects are non-cacheable and emit no referrer.
- Synthetic session and identity-link testing routes are limited to non-production loopback HTTP even when test bindings and headers are present.
- Generated Surface revisions can reference only exact, undeleted R2 assets owned by that Surface owner; route-specific asset isolation headers cannot be weakened by Worker-wide defaults.
- Profile generation briefs include only deliberately public profile fields and projects, preventing private or connection-scoped content from leaking into static generated copy.
- Blocking fails closed across Circle metadata, chat, modules, design/governance actions, notifications, invitations, and invitation acceptance.
- Aggregate privacy is enforced at the data boundary: Map and Build Graph responses contain only counts and canonical labels, never builder identities, profile text, project titles, precise locations, or hidden cities.
- Account deletion removes or pseudonymizes residual inferred-work, identity-link, evaluation, response, idempotency, cross-user notification, relationship, collaborator, and audit payload data while preserving only necessary opaque integrity history.
- Request observability redacts bearer invite tokens. The dependency toolchain has no high or critical advisories; the remaining moderate Next/PostCSS scanner finding is outside the vinext/Vite production compiler path and is tracked as an upstream transitive advisory.
- Verification after repair: all workspace typechecks, security 12/12, focused auth/surface/observability tests, D1 Surface assets 7/7, D1 privacy/abuse suites 12/12, production build, and diff check pass.

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

## Final launch-quality gates

These gates run in order and are part of launch readiness, not optional post-launch polish:

1. **Functionality and production-material pass.** Complete the selected authenticated hosting path, D1/R2 writes, MCP linking and tools, onboarding, every visible product flow, responsive states, accessibility behavior, production smoke, and the live two-user boundary where an independent identity is required. Remove dead controls, placeholders, misleading fallbacks, and claims that exceed verified runtime behavior.
2. **Security and privacy pass.** Audit identity authenticity, GitHub state/PKCE and code exchange, hashed app sessions, UUID/principal resolution, object-level authorization, MCP OAuth and single-use linking, CSRF/same-origin enforcement, input and upload boundaries, generated-surface sandboxing, secrets, rate limits, privacy audiences, blocking/redaction, deletion/export, audit trails, dependency exposure, security headers, and production error leakage. Run focused abuse cases for impersonation, cross-user access, replay, concurrency, privilege escalation, unsafe generated content, forged `oai-authenticated-*` headers, and revoked/deleted identities. Authenticated launch remains blocked until the GitHub callback, session cookie, UUID ownership, and ChatGPT/MCP linking pass in production.
3. **Copy and content-material audit.** Review every user-facing string across marketing, install, authentication, onboarding, profiles, discovery, matching, rooms, Connections, Circles, scheduling, settings, privacy, moderation, notifications, empty/loading/error/permission states, and exports. Enforce the builder-network thesis, mutual relevance rather than transactional expert matching, one terminology system, truthful privacy/automation language, concrete action labels, no internal process narration, no unsupported claims, and no generic AI/SaaS filler.
4. **Folk-referenced UI/UX audit.** Re-open the live `folk.com` reference during the audit and use its editorial clarity, confident typography, whitespace, color restraint, information rhythm, and human relationship focus as directional cues without copying its brand, assets, or layouts. Apply the canonical anti-slop design law plus the routed design/accessibility skills. Inspect every public and authenticated surface at relevant desktop and phone sizes, including long content and loading/empty/error/permission/network-failure states; verify hierarchy, gutters, overflow, touch targets, keyboard/focus, contrast, reduced motion, responsive navigation, control affordance, console errors, and network failures with saved rendered evidence.
5. **Release proof.** Rebuild and redeploy any audit changes, run focused affected checks plus the final launch matrix, record source/deployment/browser/runtime truth separately, publish the release tag only after all gates pass, and keep every remaining human-only limitation explicit.

Anti-slop remains a global implementation rule throughout all five gates; it is not deferred to the final visual pass.

The copy audit must cover projects, Circle admin/invite flows, map and graph aggregate views, follows and watches, block/report/appeal, deletion, SurfaceSpec preview/approval/history/rollback, operator recovery, plugin and MCP manifests/tool errors, Codex first-run and automation prompts, match explanations and starters, digests, ICS/calendar text, metadata and social cards, alt text, and exports. The UI/UX evidence ledger must cross route, role/state, and viewport; include anonymous, sparse-onboarding, established, connected, owner/admin/member, operator/moderator, blocked, suspended, and revoked states; and retain screenshots, console/network logs, and interaction traces. Accessibility proof includes landmarks/headings, accessible names and instructions, screen-reader announcements, non-color cues, keyboard operation, and zoom/reflow.

## Current next action

Run one clean 0/10 Codex onboarding QA against the production MCP and preserve the full task as evidence. The task handoff must label the setup and completed-installation tasks distinctly, and exact source-selection approval authorizes the stated private context collection without a second prompt. A second independent account remains necessary only for genuine two-person match, room, and Circle behavior.

## Release-candidate deployment and clean reset - 2026-07-18

- Functional release commit `7bd395337faeecf21b1d53c0685e1f2c113b5cbb` is pushed on `launch/buildmates`.
- ChatGPT Sites version 25 deployed successfully as `appgdep_6a5b170dd9ec819188cfd40652d5bea0` at `https://buildmates.yashns.chatgpt.site`.
- The external MCP Worker deployed successfully as version `2e44de1e-55c5-4dea-b686-bade5c9ed713` at `https://buildmates-mcp.yashserai1.workers.dev`.
- Production smoke passed the public landing page, D1 readiness, security headers, authenticated-route redirect boundary, robots, and manifest. `/`, `/install`, and `/llms.txt` return 200; OAuth authorization-server and protected-resource metadata return 200; unauthenticated MCP initialization returns 401.
- Source gates pass lint, all workspace typechecks, all production builds, 91/91 unit tests, 82/82 integration assertions, 35/35 contract assertions, 12/12 security assertions, 13/13 rendered web checks, and the retained desktop/phone populated and safety/settings matrices.
- The final copy scan found no public leakage of SurfaceSpec internals, setup evidence identifiers, identity scopes, or operator instructions. Technical language remains limited to restricted operator tooling and the non-production Surface Lab.
- The production website account reached the terminal deletion route, the GitHub Buildmates OAuth grant was revoked, and the Worker database was verified at zero OAuth tokens, handoffs, assertion replays, rate-limit rows, and identity principals.
- The local Buildmates OAuth credential, MCP registration, installed beta plugin, and installed cache were removed. The `buildmates-beta` marketplace remains configured so the next QA exercises a fresh installation instead of an already-loaded plugin.
- Map and Build Graph now have a live aggregate-only density fixture for founder review. Do not remove it or mark the visual gate complete until the populated UI is approved; remove all fixture rows before launch.

## Source-consent and clean-task handoff repair

- The `source_selection` and `context_collection` records remain separate resumable backend steps, but they are one user consent event when Codex states the exact local research scope first. Selecting **Use my Codex workspace** authorizes immediate review of that stated scope and completion of both records without another permission prompt.
- Source selection now includes **Skip workspace review**. That route inspects no other tasks, project folders, GBrain, or memory files and continues with approved connected sources or focused questions instead of dead-ending.
- Expanding the approved scope to another task range, project, local memory source, or connected app still requires a new confirmation.
- Beta activation now requires a clean new task titled `Buildmates setup - continue here`, not a history-duplicating fork. After the child successfully calls `get_setup_state`, the parent is titled `Buildmates installation - complete` and archived. The manual continuation remains the fallback when host task controls are unavailable.
- The MCP contract, public `/llms.txt`, public and beta onboarding skills, plugin READMEs, and package cachebusters carry the same rules. Both plugin packages validate, 18/18 focused MCP contract tests pass, workspace typechecks pass, and the public agent contract passes on desktop and phone.
- Exact implementation commit `c7a62b41dbb6e49cb68fae04f2ee80e885775a90` is live as ChatGPT Sites version 20 and MCP Worker version `0f5a30d4-d9e0-4479-915c-88e251460d84`. The versioned live contract returned all new markers; the plain `/llms.txt` path initially retained the prior edge response while caches propagated.

## Profile-design QA findings - superseded by SurfaceSpec v2

- The bounded-card limitation was confirmed during QA and is now replaced by SurfaceSpec v2: full-bleed sections, nested layout primitives, responsive 12-column canvases, bounded overlap, approved media and galleries, featured-project compositions, curated typography, motifs, and reduced-motion-safe declarative motion.
- Five same-content fixtures prove materially different full-page structures rather than palette swaps: orbital/asymmetric, editorial index, image-led field journal, maker collage, and data ledger. Desktop and phone tests enforce distinct structure, overflow safety, state handling, focus, and reduced motion.
- The first generated revision follows a user-reviewed design direction, sections, signature element, and optional installed design skills. Recovery scaffolding is invisible and cannot be submitted, numbered, shown in history, or published.
- `/profile/design` remains the owner workspace. The published `/builders/{handle}` page renders the exact approved Surface as the primary page, with trusted Buildmates navigation and actions outside generated authority plus an owner-only redesign reminder.
- Privacy review copy now explains profile visibility, matching, search indexing, aggregate city-map inclusion, private design notes, acceptance mode, and recurring Work Signals individually before one approval. Search indexing means Google and other search engines; city-map inclusion uses only a chosen city in anonymous aggregate bubbles and never precise or live location.
- The privacy explanation repair is live from exact commit `a9c2a4d6dc1135929994a3621e1689417689cb98` as ChatGPT Sites version 21 and MCP Worker version `6f0e652b-1c6f-46e3-82ae-b32c35161bb2`. Production `/llms.txt` returned the explanatory markers and unauthenticated MCP initialization remained closed with 401.

## Completed-onboarding QA verdict

- **Completed — generative profile:** SurfaceSpec v2 now supports governed full-page portfolio composition, a user-reviewed design brief, optional available design skills, private preview, and canonical `/builders/{handle}` publication. `/profile/design` remains owner-only.
- **Completed — generated-page flow:** the recovery seed is invisible and non-publishable; real revisions render identically in private preview and public profile with trusted Buildmates controls outside generated authority.
- **Required before launch — Networking Pulse explanation:** before one approval, explain intent, similar/adjacent/balanced matching, local/global geography, weekly introduction cap, quiet hours, serendipity, exclusions, and that expiry is when the temporary networking intent is reconfirmed rather than silently becoming permanent.
- **Required before launch — Work Pulse default:** when recurring automations are available, recommend one Buildmates Work Pulse on Tuesdays and Fridays. Explain that it reviews only permitted sources, refreshes approved profile/project topics and Work Signals, checks the bounded candidate shortlist and relevance watch, and posts a concise result to the Codex task inbox. Manual-only is a platform-unavailable fallback or an explicit user override, never the recommended default.
- **Completed — setup completion:** `first_useful_outcome` is no longer mandatory. Automation completes the 10-step flow; the completion state links profile, edit, design, automation, and an optional personal invite whose accepted joins are attributed to the inviter.
- **Deferred pending a supported metric source — token usage:** do not present tokens consumed as proof of shipping or infer weekly totals by scraping private Codex task logs. If Codex later exposes a verified usage API, tokens may be an optional private activity statistic with explicit publication; launch metrics should use honest project updates, shipped projects, connections, and successful invitations.

## SurfaceSpec v2 and onboarding repair - 2026-07-17

- SurfaceSpec v2 replaces the former bounded profile card with governed full-page composition while keeping scripts, forms, remote URLs, arbitrary fonts, raw SVG, permission controls, and unapproved assets outside generated authority.
- New uploads accept PNG and JPEG only, validate signatures and dimensions, remove container metadata including EXIF/GPS fields before content-addressed R2 storage, and authorize public reads only when the exact asset remains referenced by a viewer-authorized published revision. This removes container metadata, not information intentionally encoded into image pixels.
- Public and preview rendering resolve the same deliberately public profile, project, and approved-media bindings. Private Work Signals never enter either rendering path.
- The mandatory setup state is 10 steps. Networking Pulse explains every configurable value; Work Pulse recommends Tuesdays and Fridays; automation completes setup; referral creation is optional afterward.
- The personal invite page infers the signed-in inviter, tracks accepted joins, caps active links, and does not ask for a redundant username.
- Verification evidence: 89/89 unit tests, 12/12 security tests, 5/5 rendered-source tests, 8/8 Surface Lab desktop/phone tests, 12/16 combined affected E2E tests on the first run plus all 4 repaired failures passing on rerun, two focused surface-media integration regressions passing, both plugin bundles validating, workspace typechecks, clean ESLint, `git diff --check`, and the production web build. The Windows Vitest contract runner completed its assertions in earlier focused runs but failed to exit cleanly in the final combined process; it was terminated without treating the hung process as new pass evidence.
- Production truth: implementation commit `b6a1d2cc676b877acecfa63202b9e883d667a8fd` is pushed to GitHub. ChatGPT Sites version 24 deployed successfully as `appgdep_6a5af23c9b908191966b774d4c4ff580`; the MCP Worker deployed as version `8d5448ed-4fc8-4495-a3ee-2de590db1c9f`. Landing, install, and `/llms.txt` return 200 with the revised contract, while unauthenticated MCP initialization remains closed with 401. The deleted/reset `yashns` profile correctly returns 404 until the clean onboarding run republishes it.
- The locally installed beta plugin is updated to `0.3.0-beta.1+codex.20260718012000`, so the next fresh Codex task loads the revised onboarding and SurfaceSpec guidance.

## Anonymous Map and Build Graph repair

- Map participation is independent of profile publication. When a user deliberately supplies a supported city, anonymous aggregation is enabled by default unless they hide it. The first participating builder can create a city bubble; Buildmates never infers precise or live location.
- Setup and recurring Work Pulses classify only reviewed work into canonical topic IDs. The graph aggregates those IDs from reviewed profiles, active project taxonomy, and approved unexpired Work Signals; raw text, source excerpts, prompts, handles, project titles, and user IDs never enter its response.
- The graph returns topic nodes, weighted co-occurrence edges, and canonical parent/child relationships. Its interactive field opens on broad/root topics, supports click-to-focus drill-down, and shows the strongest child and neighboring topics with keyboard and reduced-motion support.
- A built-in versioned topic hierarchy gives Codex stable IDs from `list_topic_taxonomy`; setup and Work Pulse skills must read it before classification. The migration backfills only canonical IDs from already-approved profile summaries so existing builders are not left out after launch.
- Focused source proof: workspace typechecks pass, anonymous Map/Graph Miniflare tests pass, the canonical taxonomy contract passes, lint exits without new errors, and the production web build passes.
- Production truth: exact code commit `18cd08371f54a839c465de69b757694b7d914451` is live as ChatGPT Sites version 23 and MCP Worker version `0f9173f8-016a-4d50-9b1c-1d507c65586b`. The public graph rendered the existing approved profile as AI, Automation, and Productivity and workflows; click-to-focus and back navigation worked, and the 2560px browser check had no horizontal overflow. No Map city was fabricated because this profile has not deliberately supplied one.
- **Live visualization fixture:** Sites version 27 (`appgdep_6a5b230338f88191b0e59c8a44314d8d`) contains 36 private, unindexed, nonmatching fixture builders across eight city aggregates, 36 unpublished projects, 24 canonical topics, 41 weighted edges, and 18 cross-topic relationships. No fixture handle, public profile, project title, raw work, or internal ID appears in either public response.
- Automated fixture validation passes exact city counts of 8/7/6/5/4/3/2/1. Live desktop and phone checks pass without horizontal overflow or console errors; root-topic layout, AI drill-down, back navigation, aggregate transcript/table, singular labels, and persistent city detail popups are verified.
- **Pre-launch TODO:** keep the fixture live while the founder adjusts and approves the populated visual design. After approval, remove every `qa_visual_*` row, redeploy, and verify the honest sparse state before marking Map and Build Graph launch-complete.

## Codex acquisition path added 2026-07-16

- The landing page now states that Codex creates the profile and routes the primary action through a canonical public setup guide instead of assuming visitors already know or have installed Buildmates.
- The setup guide provides the registered Buildmates app link, one copyable prompt containing the guide URL, a manual text-selection fallback, and a concise description of the completed first run.
- `/llms.txt`, the root README, and the plugin README point agents to the same setup contract. The GitHub repository remains supporting documentation rather than a requirement for ordinary installation.
- The plugin's existing mandatory onboarding skill remains authoritative after connection. Website onboarding remains an optional fallback.
- Focused source checks pass lint, web typecheck/build, rendered HTML, and the affected desktop/phone Playwright paths. Screenshots confirm the landing and install guide have no horizontal overflow at the tested viewports.
- ChatGPT Sites version 6 is live from exact code commit `e3d7348418eb56ee21329fc144430da7c69bc38f`. Production returned 200 for the landing, `/install`, and `/llms.txt`; the live HTML contains the Codex CTA, registered app link, and canonical agent setup contract.
- The landing acquisition action is intentionally one control: **Set up with Codex** copies the canonical prompt and opens a dismissible toast showing the exact text. The prompt remains selectable when clipboard access is blocked. The control stays disabled until hydration completes so an early click cannot be lost.
- ChatGPT Sites version 7 is live from exact code commit `007e2f5e2b61660694fec3563c192f23f1e422a4`; production returns 200 with the single CTA and no retired **Copy setup prompt** control.
- The setup prompt now opens as a centered modal with a restrained page-dimming backdrop. It remains selectable, traps keyboard focus, closes through Escape, its close control, or the backdrop, restores focus to **Set up with Codex**, and stays within phone viewports.
- ChatGPT Sites version 8 is live from exact code commit `b4fe9e7af13055b3314bef1962bbf7bb5238ad73`; focused desktop and phone interaction checks verify centering, backdrop visibility, prompt fallback, Escape dismissal, and focus restoration.
- ChatGPT Sites version 9 is live from exact code commit `3e8a03949685ed90e6a807d83d134fb847bcaefb`. The copied prompt now contains only the canonical install URL. The public install page, `/llms.txt`, and plugin onboarding contract make `get_setup_state` the sole progress authority and forbid inferring resumable state from old conversations, tabs, routes, files, or prior task wording. The install-page copy and UI/UX pass passed 12/12 focused desktop/phone checks and rendered screenshot inspection.
- Native plugin distribution is a launch gate, separate from the registered remote ChatGPT app. Once Buildmates is published and discoverable, Codex must present its native plugin-install confirmation and must not automate ChatGPT in Chrome. Before publication, it truthfully offers the official manual app link. GitHub website identity remains a separate OAuth handoff with manual completion by default and explicitly approved guided browser help as an option.
- ChatGPT Sites version 11 is live from exact commit `0ab09f5eeb26e146334a0222e87d56974866496c` with the native-install and GitHub OAuth handoff contract. Version 10 was never deployed because its archive was caught before publication as stale.
- Onboarding uses bounded approval batches of up to three concrete actions to reduce permission fatigue. Each batch exposes inputs, writes/actions, and visible outcomes before one approval. A changed plan invalidates the remainder. Plugin installation, provider consent, the first exact Work Signal, Surface publication, automation creation/schedule changes, host confirmations, and interpersonal actions outside the saved acceptance mode retain separate consent.
- ChatGPT Sites version 12 is live from exact commit `312182668ea6d4a3078d4278539666e63f1c7491` with the bounded three-action approval contract; production `/install` and `/llms.txt` verification passed.
- Source selection must offer three explained, combinable paths: current context already surfaced in the Codex task, connected apps genuinely available in that task, and user-provided descriptions or links. GitHub website identity never makes GitHub a source; a public GitHub URL is manual material unless the connector is actually available. Buildmates does not ask for session IDs or inspect unrelated chats by default.
- ChatGPT Sites version 13 is live from exact commit `301a2f343103479c7b65f5db01ebb8eacca62532` with the corrected source-selection contract; production `/install` and `/llms.txt` verification passed.
- Pre-publication distribution now has two real paths: the repository beta `buildmates@buildmates-beta` and direct production MCP. Codex CLI successfully added the GitHub marketplace, installed beta version `0.3.0-beta.1`, and completed the production Worker OAuth flow with dynamic client registration, PKCE, explicit Buildmates consent, and a loopback callback. ChatGPT Sites version 15 is live from exact commit `12dec3c517694a84070501353b6801347d26526c` with that consent handoff and the beta install guide.
- The acquisition handoff is now native-first. **Set up with Codex** copies a prompt containing the direct `/llms.txt` URL; Codex fetches that public text and uses native plugin or MCP commands. `/install` remains human-facing and does not expose repository commands, production endpoints, or agent workflow notes. Browser use is limited to user-controlled authentication and OAuth consent.
- The landing and install actions share one accessible centered modal. A nested-section style collision found during screenshot QA was removed; focused desktop/phone checks verify centering, viewport containment, backdrop visibility, prompt selection, exact `/llms.txt` value, Escape dismissal, and focus restoration. ChatGPT Sites version 16 is live from exact commit `f69509485f83da61f479645c471451ac0351cd1b`.
