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
| Matching | Seeded relevant builders enter the bounded shortlist | Seed manifest and server result | Pending |
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
| Two-account | Genuine independent-account behavior | Two authenticated identities | Blocked until second identity is available |

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
