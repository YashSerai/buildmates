# Buildmates Build Index

Status: clean-room onboarding QA repairs deployed; production reset complete and next 0/11 run ready
Last updated: 2026-07-17
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
| Agentic first run | Visible setup progress, rich/sparse context branches, privacy/profile preview, preferences, automation, first useful outcome | Smarter adaptive questioning | MCP pre-link setup routing and deterministic profile-surface creation repaired; source regression passed |
| Connected apps | Present identified, declared optional, or user-named sources with one Buildmates policy per source; the list is explicitly non-exhaustive | Source-specific policies and admin presets | Implemented; live connector proof pending |
| Work Pulse | Scheduled or manual extraction of approved Work Signals | Smarter cadence and stale-signal cleanup | Implemented; unattended production proof pending |
| Networking Pulse | Expiring intention, similar/adjacent, local/global, intro budget, quiet hours, snooze, serendipity, exclusions | Learned preference suggestions | Implemented; integration review pending |
| Profiles | Profile review, field-level visibility, projects, generative responsive surface, optional connection/build stats, canonical share link | Broader module library and isolated custom code | End-to-end MCP surface reachability, binding parity, preview URL, publication, history and rollback implemented; rendered production proof pending |
| Projects | Create/edit/publish/archive/delete/transfer, collaborators, visibility, matching permission, update history, canonical sharing | Richer project modules and team workflows | Implemented in source; integrated review pending |
| Cold start and growth | Shareable profiles/projects/cards, recipient-specific personal invites, follows, watches, honest no-match state | Referral analytics and organization invitations | Implemented in source; integrated review pending |
| Aggregate network views | No people/database search; MapLibre/OpenFreeMap city bubbles and public-project topic bubbles expose counts only, never rosters or drill-down | Richer aggregate filters after network density is proven | Implemented in source with canonical city aliases, five-builder threshold, honest counters and accessible aggregate fallbacks; production proof pending |
| Matching | Deterministic shortlist, independent Codex evaluations, reciprocal handshake | Optional embeddings only after measured need | Implemented; integrated source regression passed |
| Acceptance | Manual or Full Autopilot modes | Per-context acceptance rules | Implemented; live unattended capability proof pending |
| Rooms | Mutual-interest lightweight chat themed around the connection reason | Consent-based room upgrade modules | Implemented in source; integrated review pending |
| Connections | Persistent mutual relationship, why/when met, private notes, reminders, updates, mute/end | Longitudinal relationship intelligence | Implemented with shared visual system; production smoke pending |
| Intro memory | Private structured feedback and match-preference learning | Longitudinal relationship health | Implemented; integrated review pending |
| Scheduling | Calendar-aware suggestions through permitted apps and ICS fallback | More scheduling connectors | Implemented in source; live Calendar/deep-link proof pending |
| Cohorts | Deferred from the current product and navigation; dormant domain support remains isolated | Reconsider after Circles and network density are proven | Deferred by product decision |
| Circles | Consent-gated triadic suggestions, group chat, creator-admin governance, roles, voting, Codex-generated shared surfaces, approved modules and member entries | Richer tracker templates and shipping-room analytics | Implemented in source; integrated review pending |
| Generative UI governance | Private preview, approvals, history, rollback, base-version check | Sandboxed interactive code | Implemented; profile onboarding now creates/discovers its surface without website-first deadlock and rejects undeclared production profile bindings |
| Privacy and safety | Canonical visibility, source ledger, block/shared-context redaction, immediate export, physical R2 deletion, rate limits and audit trail | Organization policy tooling | Implemented; production smoke pending |
| Moderation | Restricted operator queue, report status, enforcement, impersonation/safety reasons, appeal/review | Cohort-admin delegation | Implemented; production operator QA pending |
| Notifications | Immediate in-app product events plus one Codex automation for intelligence refreshes and digests | External email adapter if required | Implemented; production polling QA pending |
| Product validation | Reproducible multi-user flow plus genuine connected-context onboarding on phone and desktop | Broader beta cohorts and production analytics | Public smoke complete; authenticated production and separate-account proof pending |

## Clean-room onboarding QA repair - 2026-07-17

- OAuth guidance announces the GitHub browser handoff, allows a five-minute user-controlled authorization window, and forbids duplicate in-flight launches.
- Onboarding recommends GPT-5.6 Luna High when selectable and operates the MCP directly without recursive `codex exec` helpers.
- Source selection recommends permissioned Codex-workspace review. A private local `.buildmates/profile-context.md` preserves multi-project research across compaction; only the reviewed structured profile is submitted.
- Profile context accepts up to 12,000 characters and the canonical profile stores richer approved fields plus private design/personality preferences.
- An approved private profile satisfies the basic-profile checkpoint. Intended public visibility no longer publishes before generated-page approval.
- Surface generation returns a known-valid starter, exposes the active schema, supports field-level dry-run validation, and keeps the starter as a recovery path.
- Work Signal wording, profile status wording, aggregate-map/indexing explanations, example metrics, and the connection-page first viewport were corrected.
- Remaining brand task: generate the final Buildmates logo with ImageGen and replace the temporary B/C connection nodes with approved Buildmates and Codex marks, including reduced-motion behavior.
- Exact source commit `7b93a9b96e0396f7779c5e38da3aec04ed49d00d` is live as ChatGPT Sites version 17 and Worker version `534d8a18-5c4e-4a68-a573-262794948822`. Production returned 200 for `/`, `/install`, `/llms.txt`, OAuth metadata, and protected-resource metadata; unauthenticated MCP access returned 401 as required.
- The production test account reached terminal deletion, external MCP OAuth/principal/handoff/replay/rate-limit state was cleared, and GitHub confirmed the Buildmates OAuth grant was revoked. The next authorization must therefore create a new Buildmates account and begin from the server-authoritative `0/11` state.
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
- Aggregate privacy thresholds are enforced at the data boundary: Build Graph topics require at least two distinct builders, Map cities require five opt-ins, and mapped-user totals exclude hidden cities.
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

Run the canonical prompt copied from the public landing page in a new personal Codex task. The clean-room reset is complete: the Buildmates account was deleted, its GitHub OAuth grant was revoked, the ChatGPT development plugin is uninstalled, remote MCP OAuth state is empty, and the local beta plugin/marketplace/MCP entries were removed after a successful install test. Complete all 11 steps and preserve the full task as clean first-run evidence. The earlier `2/11` task remains resumability evidence only; do not continue it for the clean-run test. The beta install and reset evidence is logged in `docs/evidence/production-onboarding-2026-07-17.md`. A second independent account remains necessary only for genuine two-person match, room, and Circle behavior.

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
