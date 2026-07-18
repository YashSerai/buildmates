# Buildmates agentic product QA

Status: In progress

## Evaluation rules

Every Codex interaction is judged on:

1. Clarity: the user understands what happened, what Buildmates changed, and what comes next.
2. Friction: Codex does not repeat consent, over-prompt, or split reversible actions into unnecessary steps.
3. Quality: Codex uses permitted workspace context to produce accurate project, interest, matching, and design inputs without inventing facts.

Only the official Buildmates setup prompt may be optimized. After setup begins, QA replies stay short and natural, such as `confirm`, `continue`, or an ordinary product question. The run must not coach Codex with hidden schemas or ideal tool sequences.

## Evidence requirements

- Record every visible Codex task ID and keep the task accessible to the founder.
- Record the exact user prompt for each judged interaction.
- Save a screenshot of every key Codex result and each tested website state.
- Keep source-control, deployment, browser, and live-runtime evidence separate.
- Do not mark a behavior passed from unit or contract tests alone when the gate requires a visible Codex or production-browser result.

## Checklist

| Area | Scenario | Evidence required | Status |
|---|---|---|---|
| First run | Fresh task begins at authoritative 0/10 | Task ID, state response screenshot | Pass (task transcript) |
| First run | Complete setup using short natural replies | Conversation screenshots and friction notes | Pending |
| Context | Workspace review identifies real projects and interests | Draft screenshot plus fact audit | Pending |
| Context | Workspace discovery inventories all accessible tasks and groups every project before consent | Task inventory, project list, and fail-fast evidence | Pending |
| Context | Design inputs capture approved aesthetic preferences | Draft screenshot; founder reviews visual result | Pending |
| Profile | SurfaceSpec profile is generated and valid | Preview link and validation result | Pending |
| Profile | Founder approves customization quality | Founder decision | Founder review |
| Work Pulse | Explanation covers schedule, sources, refreshes, shortlist, watches, output, and next run | Explanation screenshot | Pending |
| Work Pulse | Exactly one near-term QA automation is created | Automation/task evidence | Pending |
| Work Pulse | Meaningful two-way activity prompts for feedback without reading messages | Contract proof plus live automation response | Pending live; source pass |
| Work Pulse | Positive viewer feedback suggests one optional contextual room module; both members still approve | Contract proof plus live two-principal evidence | Pending live; source pass |
| Matching | Seeded relevant builders enter the bounded shortlist | Seed manifest and server result | Pass (local E2E) |
| Matching | Ordinary prompt surfaces potential matches in Codex | Prompt and Codex response screenshot | Pending |
| Matching | Scheduled Work Pulse surfaces relevant matches | Automation response screenshot | Pending |
| Matching | Manual acceptance preserves consent | Codex and website evidence | Pending |
| Matching | Full Autopilot converges reciprocal approvals once | Codex, Connection, and room evidence | Pending |
| No-change | Second Work Pulse reports no changes without fabrication | Automation response screenshot | Pending |
| Website | Introductions | Desktop and phone screenshots | Pending |
| Website | Connections and one-to-one room | Desktop and phone screenshots | Pending |
| Website | Activity | Desktop and phone screenshots | Pending |
| Website | Circles, invitation, roles, and chat | Desktop and phone screenshots | Pending |
| Website | Projects and collaboration | Desktop and phone screenshots | Pending |
| Website | Profile, privacy, safety, and Work Pulse settings | Desktop and phone screenshots | Pending |
| Cleanup | Remove scoped QA network and automation | Database and task evidence | Pending |
| Two-account | Independent-principal consent, rooms, Circles, roles, and isolation | Two authenticated identities | Pass locally; external production login pending |

## Run ledger

Add one dated entry per interaction with: task ID, prompt, result, evaluation, screenshot path, and any issue or fix.

### 2026-07-18 — acquisition and authorization

- Task: `019f76fd-8479-7271-ac82-826ac99d37f4` (`Buildmates autonomous QA - onboarding and Work Pulse`)
- Prompt: `Set up Buildmates for me using the official Codex instructions: https://buildmates.yashns.chatgpt.site/llms.txt`
- Result: Codex found that Buildmates was not loaded, recommended the beta plugin, installed it after the natural reply `yes`, and announced the browser handoff before opening OAuth.
- Clarity: Partial. The browser handoff was explained well, but the task cited stale local `10/11` evidence before it had an authoritative live `get_setup_state` result.
- Friction: Partial. One installation confirmation was reasonable. The first GitHub callback returned `authentication_failed`; a same-tab retry from Buildmates succeeded without new credentials. The MCP retry then completed successfully.
- Issue: The successful MCP consent redirected the browser to Codex's loopback callback, but Brave displayed `ERR_BLOCKED_BY_CLIENT` even though the CLI had already received the callback and authenticated. This is a misleading completion state: a normal user can reasonably believe authorization failed after it succeeded.
- Recovery behavior: Pass. Codex waited for one transaction, checked authentication after timeout, opened exactly one retry, and did not create duplicate authorization flows.
- Codex evidence: task transcript retained under the task ID. Direct Codex-app screenshot capture is not available to the automation surface; the task remains user-visible for inspection. Website screenshots will be saved for every browser-visible gate.

### 2026-07-18 — clean activation task

- Task: `019f7707-7b44-74b2-85c5-5b2071ac2ae0`
- Prompt: created by the setup task with the instruction to call `get_setup_state` immediately and use it as the only authority.
- Result: Pass. The beta plugin loaded, `get_setup_state({workspaceScope:"global"})` completed, and the live state was `0/10`, next step `identity_link`.
- Clarity: Pass for setup state. The response states the exact progress and next action.
- Issue: The created task has no proper title; the sidebar/list shows the raw `<codex_delegation>` payload. The parent claimed it used the specified title, so the visible result contradicts the status message.
- Fix candidate: after task creation, explicitly set and verify the title `Buildmates setup — active`, then tell the user which task to continue in.
- Resolution: the task title updated to `Buildmates setup - continue here` before identity linking completed. Treat this as a transient naming delay unless it recurs.
- Identity-link result: Pass. The website explained the one-time code and privacy boundary, the code was consumed once, and both MCP state (`1/10`) and the website independently showed the linked identity.
- Website evidence: `docs/qa/evidence/2026-07-18/identity-link-before-code.png`, `docs/qa/evidence/2026-07-18/identity-link-complete.png`.
- Codex evidence: task transcript retained under the task ID. Direct Codex-app screenshot capture is unavailable to this automation surface.

### 2026-07-18 — workspace-context scope defect

- Task: `019f7707-7b44-74b2-85c5-5b2071ac2ae0`
- Prompt: `use my Codex workspace`
- Result: Fail for profile-research scope. Codex reviewed only the current Buildmates folder plus the Buildmates GBrain entry, then completed context collection and signal privacy review.
- Expected: enumerate host-visible recent tasks, active project roots, and relevant GBrain/memory sources; identify distinct products and relationships; review that exact disclosed scope after one consent event.
- Cause: the installed skill describes the broad workflow, but does not require a concrete task-discovery call before proposing scope. The agent defaulted to its current working directory and one product-specific GBrain entry, then treated that narrow proposal as the approved complete workspace.
- Fix candidate: require task/project discovery before the source-selection prompt. Build a deduplicated research plan from accessible recent tasks, their project roots, GBrain index/product entries, and high-signal project documentation. Disclose that plan once, then review representative evidence across every discovered product without uploading raw material.
- Quality impact: the resulting profile can overfit to Buildmates and miss the founder's other products, current work, cross-project systems, and aesthetic preferences. Do not count this profile draft as a passing context result.
- QA rule added: stop immediately if task discovery is available but the proposed workspace scope contains only the current directory, or if context collection advances before every inventoried project and task is accounted for.

### 2026-07-18 — workspace inventory rerun

- Task: `019f7721-d70d-7cf0-b689-8161d7c86c38`
- Prompt: exact production setup prompt from the Buildmates site, run on GPT-5.6 Luna High.
- Reset result: Pass. The incomplete account and stale `.buildmates/profile-context.md` were removed; the new task began at authoritative `0/10`, identity linking completed, and source selection stopped at `2/10`.
- First inventory result: Fail-fast worked. The revised agent found six project groups instead of only Buildmates, but it still omitted known host-visible work such as Soulspace and SafariGigs. Setup did not advance past source selection.
- Cause: `list_threads` defaults to a shallow result window. The written requirement said to use the widest safe window but did not state the host's accepted maximum, so Luna used the default-sized inventory.
- Verified host boundary: `list_threads({ limit: 50 })` succeeds and reveals 28 project/unscoped groups, including Soulspace, SafariGigs, AfterYou, Clearfeed/X, Serai Labs, and Buildmates; `limit: 100` is rejected.
- Fix: require `limit: 50` in the plugin skill, MCP guidance, and public agent contract; if another host rejects 50, retry once at its largest accepted limit and disclose that the inventory is bounded.
- QA rule added: a workspace inventory fails if it relies on the default task window or omits a known host-visible product present in the maximum accepted metadata listing.
- Deployment note: Sites version 31's source-only build rejected the monorepo dependency layout before application build. The validated vinext output is therefore packaged with the official Sites archive contract for the replacement deployment; this is a hosting-builder limitation, not an application test failure.
- Second inventory result: Fail-fast. The 50-task window found 29 roots and included SafariGigs, but the consent prompt compressed product-bearing roots into “other discovered roots” and did not name SafariGigs. Setup remained at `2/10`.
- Additional fix: every product-bearing root and GBrain-indexed product must be named explicitly. Only non-product utility tasks may be summarized, with their total count and exclusion stated.
- Third inventory result: product coverage and 50-task reconciliation passed, but only Buildmates showed an exact path; other entries used phrases such as “project root plus SEO worktree.” This fails exact-scope consent even though discovery quality is otherwise correct.
- Additional fix: require one line per product with every absolute normalized root and reconciled task counts before source-selection consent.
- Source-selection execution issue: after approval, Luna first submitted `sourceIds:["codex_workspace"]`; the server correctly rejected the nonexistent source, and Luna recovered with `sourceIds:[]`. The agent contract must make the empty connected-source list the first write for workspace-only selection.

### 2026-07-18 — comprehensive workspace review and OAuth refresh stop

- Task: `019f7739-3259-7440-b85f-6d7e9aa02987`.
- Prompt: exact production setup prompt followed by the short natural reply `Use my Codex workspace`.
- Coverage result: Pass. Codex reconciled the maximum 50-task inventory across 29 roots, reviewed 42 product-scoped tasks, explicitly excluded 8 utility tasks, and covered Buildmates, AfterYou, Soulspace, Safari Gigs, Aloe Wellness, Serai Labs, X-growth/Clearfeed, and Codex-environment work.
- Continuity result: Pass with correction. `.buildmates/profile-context.md` contains task IDs, product relationships, confirmed facts, reviewable inferences, style direction, and missing questions. Its stale `researching` label was corrected to `review complete; awaiting authenticated Buildmates submission and user approval`.
- Efficiency result: Fail. One oversized history batch exceeded the desktop response-frame limit before the task recovered with bounded reads. Future runs need progressive task summaries rather than bulk history payloads.
- Live state: `3/10`, next `context_collection`. The structured context write was not accepted because the MCP OAuth access token expired and concurrent refresh handling invalidated the successor token family.
- Fix in progress: an already-consumed refresh token remains rejected, but a losing concurrent refresh request no longer revokes the valid successor token issued to the winner. The active task must be reauthorized once after deployment, then continued with the single natural reply `continue`.

### 2026-07-18 — concurrent OAuth refresh repair

- Source result: Pass. A refresh token remains single-use, but a replay or losing concurrent rotation no longer revokes the valid access and refresh tokens already issued to the winning request.
- Focused integration proof: `tests/integration/local-d1-platform.test.ts` passed the PKCE, audience, single-use, successor-validity, and two-request concurrency case (1 passed; 5 unrelated tests skipped).
- Live gate: Pending deployment and one normal MCP reauthorization. The active onboarding task must then continue from authoritative state without another refresh-family failure.

### 2026-07-18 — two-principal relationship and Circle journey

- Local browser result: Pass. Two independently authenticated GitHub-backed test principals and separately linked MCP identities completed reciprocal interest, exactly one Connection and room, messaging, unread/read Activity, private-note isolation, positive feedback, mutual room-tool approval, room design approval/publication, Circle invitation and join, Circle chat, shared-tool publication, Circle design publication, role promotion, and outsider denial.
- Security boundary: Pass. The two-principal seed endpoint returned `404` without the localhost E2E guard; the outsider received `404` for the Connection, room messages, room Surface, and Circle.
- Product defects found and fixed during the run: pre-hydration room interaction, async Circle form reset, missing shared-tool proposal title, and Circle/Surface governance-version drift after membership or role changes.
- Browser proof: `tests/e2e/two-principal-journey.spec.ts` passed on Chromium desktop in 31.5 seconds. Test output includes `two-principal-owner.png` and `two-principal-member.png`.
- Limitation: these are distinct local authenticated principals, not two external production GitHub accounts. The production two-account login gate remains founder-assisted.

### 2026-07-18 — integrated copy, interaction, and source gates

- All workspaces typecheck: Pass.
- Production web build: Pass.
- Rendered/copy contracts: 13/13 pass.
- Native browser dialogs: removed. Connections, rooms, Circles, projects, privacy, Codex linking, and moderation now use an accessible Buildmates confirmation or reason dialog.
- Focused lint: Pass. Repository lint has no errors; its prior unused OAuth warning was removed.
- Heavy D1 aggregate rerun: infrastructure timeout with no assertion output after 184 seconds. This does not replace the focused passing contracts or the complete browser journey and remains recorded as an unresolved test-runner performance issue.

### 2026-07-18 — reusable network scenario proof

- Source scope: local authenticated QA only; nothing was deployed. The route is unavailable in production and requires the E2E binding/header, loopback host, same-origin mutation, and a signed-in test principal.
- Scenarios: candidate spectrum, incoming interest, reciprocal Connection and room, new message, Circle invitation, renewed relevance, positive feedback/room-upgrade eligibility, permission exclusion, and a write-free no-change run.
- Cross-surface result: Pass. The same cumulative state populated Introductions, Connections, the one-to-one room, Activity, Circles, and shared-room-tool eligibility. Strong, adjacent, and weak candidates rendered; replay did not duplicate candidates; the excluded candidate and private sentinel never rendered; exactly one Connection and one room existed.
- No-change seed result: Pass. `no_change` performed no writes and returned `changed: false` with the identical state digest. This proves the fixture boundary; the scheduled Codex Work Pulse no-fabrication gate remains pending until the automation itself runs.
- Cleanup result: Pass. Viewer-scoped deterministic QA rows were removed, and the Connection and Circle disappeared from their signed-in pages.
- Browser evidence: `tests/e2e/qa-scenarios.spec.ts` passed in Chromium desktop and Pixel 7 projects (`2/2`, 28.3 seconds). Web typecheck and scoped `git diff --check` also passed.
- Seed contract and operator order: `docs/qa/scenario-seeding.md`.

### 2026-07-18 - Work Pulse feedback and room-upgrade contract

- Source result: Pass. `get_room_summaries` now returns bounded privacy-safe engagement metadata: non-deleted message count, deterministic meaningful two-way activity, last activity, only the linked viewer's feedback-submitted/positive state, and shared pending/active upgrade state.
- Privacy result: Pass. Contract coverage proves the response contains no raw message text, feedback reasons, or another member's private feedback; a non-member remains unauthorized.
- Agent behavior result: Pass at source/contract level. Work Pulse asks how an eligible introduction went, calls `submit_intro_feedback` only after the user answers, and may suggest at most one contextual optional module only after this viewer's positive feedback. It never auto-activates; both active room members still approve the shared proposal.
- No-change rule: Pass at source/contract level. Guidance requires unchanged runs to say nothing changed and forbids relabeling old activity or unanswered actions as new.
- Verification: `@buildmates/mcp-core` typecheck passed; `tests/contract/mcp-tools.test.ts` passed `22/22`; the focused canonical D1 privacy/eligibility test passed `1/1`; targeted ESLint and `git diff --check` passed. The full canonical contract file was not used as completion evidence because the all-file run exceeded the initial bounded command window; the focused affected path passed.
- Remaining live gates: deploy the Site and Worker changes, refresh the installed beta plugin, run the one scheduled Work Pulse against seeded meaningful activity, answer the feedback question naturally, verify the contextual suggestion, approve it from both principals, and run the unchanged scenario to confirm the visible Codex result does not fabricate an update.

### 2026-07-18 - unknown-route recovery and project shell

- Source result: Pass. Unknown page routes now render a Buildmates not-found surface with the real product header and footer, a signed-in-aware primary recovery action, and a secondary Build Graph path. A direct local request returned HTTP `404` while preserving the branded copy and both recovery links.
- Project-route result: Pass at source level. Project detail, creation, editing, and collaboration now use the shared product navigation. Creation returns to the profile, editing returns to the project, collaboration returns to Activity, and accepted collaboration links directly to the project.
- Copy result: Pass. Project detail no longer displays raw lowercase stage/status values, select labels are humanized, and collaborator roles read as user-facing phrases. Stage remains a bounded text field because the domain has no canonical supported-stage enum or table; inventing a select would reject valid existing values.
- Verification: web typecheck passed; the configured repository lint command passed with one unrelated warning in `apps/mcp/src/d1-oauth-store.ts`; desktop project-route coverage passed; Pixel 7 profile/project coverage passed `3/3`; scoped `git diff --check` passed. A broader desktop run passed `8/9`; its only failure was an unrelated stale install-copy assertion.
- Screenshot gate: Pending. Capture the not-found page plus populated project detail, new project, edit project, pending collaboration, accepted collaboration, and unauthorized dynamic-route recovery at desktop and phone sizes. Record them under `docs/qa/evidence/YYYY-MM-DD/pages/` using `docs/qa/screenshot-catalog/manifest.csv`; do not mark the Website projects/collaboration row complete until those rendered captures pass.

### 2026-07-18 - relationship-surface copy and Activity context

- Activity result: Pass at source/unit level. Notifications now use authorized payload labels when available, including builder, sender, Circle, project, and room-tool names. Production message, Circle invitation/message, and renewed-relevance producers carry the relevant safe labels; reusable seeded scenarios carry the same labels so populated Activity QA is distinguishable.
- Introductions result: Pass at source level. Reciprocal agent decisions read as `Your recommendation` and `Their recommendation`; each shortlist card has one primary Codex action and keeps the copy fallback behind `Can't open Codex?`.
- Connections and group result: Pass at source level. Connection dates and muted state now read as sentences; Circle summaries count only proposals awaiting a decision; empty room design history has a clear first-design action.
- Settings/install copy result: Pass at source level. Raw automation capability values, `hard introduction budget`, `cadence`, record-schema labels, task-only workspace language, and approval-batch narration were replaced with user outcomes.
- Verification: web typecheck passed; focused notification-presentation tests passed `2/2`; targeted ESLint and `git diff --check` passed. The affected Miniflare integration suites were started twice but did not finish within bounded windows while several concurrent QA workers were active, so their new payload assertions remain pending in the next uncongested integration run.
- Separate remaining cleanup: native browser confirmation/prompt dialogs were outside this bounded lane. They remain in Connections, room safety, Circle membership, Privacy controls, and Activity appeals and should be replaced with the shared accessible dialog system before the final UI gate.

### 2026-07-18 - website onboarding and profile-preview gate

- Page-preview result: Pass at persistence and UI-contract level. Website onboarding no longer presents or approves a generic summary card. It exposes only a validated, non-recovery SurfaceSpec v2 private revision and requires the exact revision ID before publishing the Surface and profile or completing `page_preview`.

### 2026-07-18 - beta plugin Surface submission catalog repair

- Live-task reproduction: task `019f7739-3259-7440-b85f-6d7e9aa02987` loaded `get_surface_generation_brief`, `validate_surface_spec`, `decide_surface_revision`, and `rollback_surface`, but its Codex tool catalog omitted `submit_surface_revision`; setup therefore stopped safely at `6/10` with no revision submitted or published.
- Root cause: `submit_surface_revision` was the only MCP tool advertising the full SurfaceSpec v2 JSON Schema. Its catalog schema was 23,793 bytes, while the adjacent surface-tool schemas were 333-716 bytes. Codex silently excluded that oversized tool definition.
- Repair: the submission tool now advertises the generated spec as an opaque validated object, matching `validate_surface_spec`, while the server continues to enforce the same strict `safeParseSurfaceSpec`, active Design Policy, authorized binding/media, design-brief, and starter-rejection checks before persistence. The catalog schema is now 1,295 bytes.
- Regression: the capability gate requires both validation and submission tools and fails if any Buildmates tool schema exceeds 16,000 bytes. Focused integration, MCP typecheck, and surface submission/approval contract verification pass.
- Deployment: source commit `8c17bd8` is pushed and Cloudflare Worker version `eb7ffaef-bf20-4a3b-95e9-09b060851852` is live. The production endpoint still rejects unauthenticated MCP initialization with `401` and the protected-resource challenge.
- Resume boundary: reload the MCP catalog in a new task or reconnect. The existing task's loaded catalog cannot acquire a newly exposed tool in place; authoritative onboarding data remains resumable at `page_preview`.
- Source-selection result: Pass at source level. Install and manual fallback copy lead with permissioned Codex workspace review, explain that research stays in Codex, and hand the user back to the guided Codex flow. Task-only and internal approval-batch narration were removed.
- Work Signal result: Pass. Website review labels are humanized and the approved summary limit is 12,000 characters rather than 1,200.
- Focused verification: web typecheck passed; onboarding/privacy integration passed `3/3`; the recovery-seed/private-preview regression passed again `1/1`; targeted ESLint passed; the production web build passed; scoped `git diff --check` passed.
- Aggregate note: repository-wide lint and the rendered-web suite were also run while other QA lanes were editing. They stopped on unrelated concurrent changes in `RoomClient.tsx` and a stale `RevisionPreview.tsx` static assertion. Neither failure is in this onboarding lane; the primary integration pass must rerun the aggregate gate after all lanes settle.

### 2026-07-18 - isolated two-principal browser journey

- Harness boundary: Pass. `two-principal-journey.spec.ts` creates two distinct GitHub-backed website principals in isolated browser contexts, links a separate local MCP identity to each through the real one-time-code flow, and uses a third authenticated outsider. Its seed route is loopback-only, same-origin, E2E-header gated, signed-in, and returned `404` without the local E2E header. No production test route is exposed.
- Cross-surface prefix: Pass in two consecutive desktop runs. Both principals saw the seeded strong candidate in Introductions, concurrent `Interested` actions produced exactly one shared Connection and room, a room message appeared for the other principal, Activity showed and cleared its unread event, the author's private note remained `null` for the peer, and the outsider received `404` for the Connection. Positive private feedback then enabled a mutually approved shared room tool, and a SurfaceSpec room design was approved by both principals and published.
- Hydration defect and fix: The first run exposed a real SSR hydration race: the room textarea accepted pre-hydration typing in the DOM while React state remained empty, leaving Send disabled. The composer now uses a lint-clean hydration snapshot and keeps the textarea and submit action unavailable until React owns the controlled state. Scoped lint passes.
- Circle suffix: Pending integrated rerun. The harness created the Circle, but its locator expected `Accept invitation` while the product correctly labels the action `Join Circle`; the click waited until the suite timeout. The selector is corrected. Circle join, chat, sequential module/design governance publishing, admin promotion, and outsider Circle denial were not reached after that correction and must not be called passed until the integrated journey completes.
- Evidence limitation: This is a high-fidelity local two-principal simulation using real application sessions, authorization, database rules, and three isolated browser contexts. It is not a substitute for the final test with two independent external GitHub/Codex accounts.

### 2026-07-18 - canonical taxonomy write contract

- Defect: live onboarding received canonical topic `ai` from `list_topic_taxonomy`, but both profile and Work Signal inputs reused the general resource-ID schema and rejected its two-character identifier before taxonomy validation.
- Repair: canonical taxonomy fields now use a dedicated bounded identifier schema. General resource IDs retain their existing three-character minimum.
- Round-trip proof: every canonical topic returned by `list_topic_taxonomy`, including `ai`, is written through both `update_profile_model` and `submit_work_signal` in bounded batches.
- Tool-call clarity: the published `update_profile_model` schema and description explicitly place `idempotencyKey` inside `profile`; a top-level misplaced key remains invalid.
- Verification: `@buildmates/mcp-core` typecheck passed; the complete MCP tool contract passed `24/24`; repository lint and final diff checks are recorded after the aggregate gate.
