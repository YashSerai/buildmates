# Production onboarding evidence - 2026-07-17

## Run under review

- Codex task: `019f6f11-2fe0-75f1-90bc-8e6ffefdd9ea`
- Entry path: the canonical prompt copied from the public Buildmates landing page
- Account: owner test account
- Model: Luna High, intentionally selected to test a more token-efficient first run
- Classification: resumability test, not a clean first-run test

## Observed result

Buildmates returned `2/11` with `source_selection` next. The persisted completed steps were `identity_link` and `storage_explanation`. The earlier production reset therefore did not remove the complete website identity, Codex identity link, and setup state required for a genuine `0/11` run.

## What passed

- Codex used the canonical public setup prompt and official install guide.
- It called the real `get_setup_state` tool with workspace scope `global`.
- It made no Buildmates data writes before consent.
- It did not read connected-app context or submit a Work Signal.
- It asked before using connected sources.

## Open onboarding issues

1. `get_setup_state` was not the first operational action. Codex opened the guide and browser before checking the safe setup state.
2. The response did not restate the complete first-run finish line. Because the task resumed at `2/11`, this may be intentional concision; verify whether the contract should require the finish line on every resumed task or only at a genuine first run.
3. The response omitted the Luna Extra High first-run recommendation and the fact that Buildmates cannot enforce the model. The tester intentionally used Luna High to measure whether the workflow remains reliable and more token-efficient, so this is a contract-strictness observation rather than a model failure.
4. Source selection immediately asked the user to name sources instead of first presenting any apps visible with confidence and explaining that the list may be incomplete.
5. A full production reset must remove or revoke the Buildmates web session and provider mapping, MCP identity link, setup progress, and all user-owned product records before the clean `0/11` run.
6. Fresh task `019f6f23-55f7-7150-b2a7-a79eb08022cd` read the public guide but inferred **ready to resume** from an old ChatGPT conversation instead of connecting the official app and calling `get_setup_state`. The old conversation was browser history, not persisted Buildmates setup state.

## Install-page audit follow-up

The public `/install` page needs a focused copy and rendered UI review after the active functionality run. This is logged as an audit requirement rather than a diagnosed defect until screenshot-led review identifies specific copy, hierarchy, spacing, responsive, or interaction failures. The audit must preserve one canonical setup prompt and the official app/guide handoff.

## Next verification sequence

1. Start a new Codex task with the one-line prompt copied from the live landing page.
2. Require Codex to connect the official app and call `get_setup_state` before reading prior Buildmates conversations or asking for source access.
3. Require `0/11` with `identity_link` next, then complete all 11 steps one decision at a time.
4. Preserve the complete task and record every divergence. Use a second independent account only after the single-user flow passes.

## Clean-reset proof

- The original owner Buildmates account was deleted through the production privacy flow, removing the web session, GitHub provider mapping, MCP identity link, setup state, and user-owned product records.
- Opening a protected route during verification reused the still-authenticated GitHub browser session and automatically created a new empty Buildmates account. That empty account was immediately deleted. Future reset verification must use `/account` and the MCP setup-state read, never a protected route.
- The public `/account` page then showed **Sign in to Buildmates** with no authenticated Buildmates session.
- The Buildmates entry was explicitly revoked from GitHub Authorized OAuth Apps; GitHub confirmed the revocation and the authorized-app count decreased from 15 to 14.
- A final production `get_setup_state` returned `completedCount: 0`, `totalSteps: 11`, and `nextStep: identity_link`.

## Online setup authority repair

- The copied prompt now points Codex directly to the machine-readable contract: `Set up Buildmates for me using the official Codex instructions: https://buildmates.yashns.chatgpt.site/llms.txt`.
- The live `/install` page and `/llms.txt` state that `get_setup_state` is the only setup-progress authority and that old conversations, tabs, routes, files, and prior task wording must not be used to infer resumable state.
- The plugin onboarding skill and plugin README carry the same rule. If the setup-state tool is unavailable, Codex must complete the official app connection rather than substitute browser history.
- The install page received the requested copy and UI/UX pass: one primary action, centered accessible prompt dialog, compact editorial hierarchy, and phone-safe layout. Agent-only commands and endpoints live in `/llms.txt`, not in the human-facing page.
- Web lint and typecheck passed. The focused public suite passed 12/12 across desktop and phone, including copy-dialog behavior, exact prompt content, public agent-contract text, and overflow checks. Rendered desktop and phone screenshots were inspected.
- Exact commit `3e8a03949685ed90e6a807d83d134fb847bcaefb` is live as ChatGPT Sites version 9. Production returned the new install page and the strengthened `/llms.txt`; the static asset briefly remained on the prior edge-cache response during propagation, then returned the new contract.

## Native install and OAuth handoff correction

- The setup contract now requires the host-native Codex plugin-install confirmation and forbids using Chrome automation to install or connect Buildmates through the ChatGPT website.
- Native installation still requires the user's confirmation. Until Buildmates is published and discoverable, Codex must disclose that native installation is unavailable and offer the official manual app link.
- GitHub remains an external OAuth handoff. Codex asks whether the user wants to complete it themselves or wants guided browser help; manual completion is the default, and guided help cannot silently handle credentials, verification codes, or provider consent.
- The affected public contract passed lint, web typecheck, and 12/12 focused desktop/phone checks with rendered screenshot inspection.
- Sites version 10 was saved against a stale pre-rebuild archive and was intentionally not deployed. A corrected production build containing the verified native-install copy was created before the next version save.
- Exact commit `0ab09f5eeb26e146334a0222e87d56974866496c` is live as ChatGPT Sites version 11. Production verification found the native-install, no-Chrome-automation, manual-or-guided GitHub OAuth, and setup-state authority markers on both `/install` and `/llms.txt`.

## Bounded approval batches

- Routine onboarding work is grouped into approval batches of at most three fully described actions. Each action discloses the data or source used, the write or external action, and the visible result. One approval covers the unchanged batch.
- A changed input, scope, consequence, or result-dependent later action ends the prior approval and requires a revised batch.
- Native installation, credentials/provider consent, the exact first Work Signal summary, Surface publication after preview, automation creation or material schedule changes, and interpersonal actions outside the saved acceptance mode remain separate checkpoints. Host confirmations still apply.
- The revised public and plugin contracts passed lint, web typecheck, production build, and 12/12 focused desktop/phone tests. Desktop and phone screenshots were inspected for the additional copy and retained the established layout without overflow.
- Exact commit `312182668ea6d4a3078d4278539666e63f1c7491` is live as ChatGPT Sites version 12. Production verification found the three-action batching, single-batch approval, no-unknown-results, and retained host-confirmation markers on `/install` and `/llms.txt`.

## Source-selection correction

- The live first-run test offered only `manual only` and `GitHub public profile` without explaining either choice. This was rejected as ambiguous and as an incorrect conflation of GitHub website identity, a public URL, and an installed GitHub connector.
- The corrected contract presents three combinable paths: current context already surfaced in the Codex task, connected apps actually available in that task, and user-provided descriptions or links. Every path explains what Codex reads and that the approved structured summary is reviewed before submission.
- Other chats, open tasks, and session IDs are outside the default source-selection boundary. Host memory already surfaced in the current task may inform a draft; Codex does not crawl unrelated conversations.
- Exact commit `301a2f343103479c7b65f5db01ebb8eacca62532` is live as ChatGPT Sites version 13. Production `/install` and `/llms.txt` verification found the current-context, combinable-paths, no-GitHub-identity inference, and no-session-ID markers.

## Pre-publication beta distribution

- The repository exposes `buildmates@buildmates-beta` through `.agents/plugins/marketplace.json`. Its plugin package contains the complete Buildmates skills and connects directly to `https://buildmates-mcp.yashserai1.workers.dev/mcp`.
- Direct MCP remains a smaller fallback and uses the same production endpoint with an explicit OAuth resource override.
- Codex CLI 0.142 completed dynamic client registration and OAuth login against the production Worker after the OAuth audience was normalized to the canonical Buildmates resource.
- Dynamic clients are limited to exact loopback IP callbacks, use PKCE S256, receive no client secret, and require an explicit Buildmates website authorization confirmation. The development app ID is no longer a dependency for beta testers.

## Beta install and clean-room reset proof

- Codex CLI installed the repository marketplace from `YashSerai/buildmates` at `launch/buildmates`, then installed `buildmates@buildmates-beta` version `0.3.0-beta.1`. The installed plugin exposed the production `buildmates` MCP server and correctly reported OAuth as not yet authorized.
- A separate production OAuth run completed dynamic client registration, displayed the Buildmates-owned consent page, returned through the loopback callback, and reported a successful Codex MCP login.
- The QA identity was then reset at every owned boundary: the Buildmates account reached the terminal deletion page, the Buildmates GitHub OAuth grant was revoked, remote MCP tokens/principals/handoffs/replay markers/rate-limit rows were deleted, and the local beta plugin, marketplace, MCP configuration, and OAuth credentials were removed.
- The registered ChatGPT development plugin now presents **Install plugin**, confirming it is not installed for the test account. The next QA run must install or connect Buildmates again and must use `get_setup_state` as its only progress authority.

## Native-first public handoff

- The homepage and `/install` now share one centered setup dialog. A prior install-page selector restyled the dialog because it was a nested `<section>`; changing the dialog to a dedicated non-section container removed the collision. Desktop and phone screenshots confirm centered, viewport-contained rendering with no status/close overlap.
- The copied prompt links directly to `/llms.txt`. That contract tells Codex to fetch it as public text, use native plugin and MCP commands, and avoid opening the install guide, repository, ChatGPT, or Codex in browser automation.
- Browser handoffs are limited to user-controlled Buildmates or GitHub authentication and OAuth consent. Credentials, verification codes, and consent remain user actions.
- Web typecheck, production build, and 6/6 focused desktop/phone tests passed. Exact commit `f69509485f83da61f479645c471451ac0351cd1b` is live as ChatGPT Sites version 16. Production checks confirmed the human-only install copy, direct `/llms.txt` contract, native-command rule, centered dialog, exact prompt, and visible backdrop.

## Six-of-eleven onboarding repair and second clean reset

- The failed QA run stopped at `6/11` because the generated profile contract was richer than the MCP-visible SurfaceSpec input. The repaired MCP publishes the complete schema, a known-valid starter, a validation-only tool, and exact failing property paths. A valid starter now provides an automatic recovery path before the user is asked to intervene.
- Onboarding now operates through direct MCP calls in one Codex task, recommends GPT-5.6 Luna High when selectable, and uses a permissioned Codex-workspace review as the primary profile source. A local `.buildmates/profile-context.md` draft preserves private multi-project research across compaction; Buildmates receives only the reviewed structured profile.
- The private profile draft and website editor now share richer fields for projects, interests, ambitions, explorations, meeting preferences, approved design/personality preferences, links, and optional public metrics. Private approved context accepts up to 12,000 characters. Intended visibility remains a draft until a valid generated page is approved.
- Setup failures now return machine-readable missing evidence and every incomplete turn must state what succeeded, what failed, the next action, and the fallback. Profile and Work Signal copy now explicitly distinguishes the saved profile draft from recurring matching signals.
- Focused MCP, web, Surface, security, unit, profile, and connection tests passed. The aggregate contract command hit the existing Miniflare runtime timeout without a product assertion failure and was not used as completion evidence.
- Exact source commit `7b93a9b96e0396f7779c5e38da3aec04ed49d00d` is live as ChatGPT Sites version 17 (`appgdep_6a5aa2e3d21481918a7804f8860eaeab`). The external MCP is live as Worker version `534d8a18-5c4e-4a68-a573-262794948822`.
- Production checks returned 200 for the public Site, install guide, `/llms.txt`, OAuth metadata, and protected-resource metadata. `/llms.txt` contains the GPT-5.6 Luna High and Codex-workspace guidance and contains no GPT-5.5 instruction. Unauthenticated MCP access returned 401.
- The second reset reached the production terminal account-deletion state. External Worker D1 counts for OAuth tokens, authorization handoffs, assertion replays, MCP rate limits, and identity principals are zero. GitHub displayed the final revoke confirmation and then removed Buildmates from Authorized OAuth Apps. The next QA run is ready to begin at `0/11` with a new authorization.
- Deferred brand work remains explicit: generate the final Buildmates logo with ImageGen, then replace the temporary B/C connection animation with the approved Buildmates and Codex marks and a reduced-motion state.

## Beta activation handoff repair

- Clean QA task `019f721b-2b85-7c72-8f5c-f0e0b6728887` installed beta `0.3.0-beta.1`, but the current task's immutable tool registry did not expose the new skill or MCP tools. It could inspect the installed files and run MCP OAuth through the CLI, but `get_setup_state` was not callable in that task. The earlier apparent one-task behavior depended on recursive child Codex processes and is not an acceptable activation path.
- The official contract now completes MCP authentication in the installing task, explains the reload boundary, and asks: “Buildmates is installed. May I open a fresh Codex task to activate it and continue setup?” After approval, Codex uses the host's native task-creation capability with the exact continuation prompt. If native task creation is unavailable or fails, the same prompt is shown for manual copy and paste.
- Direct MCP uses the same fresh-task fallback only when its tool registry does not refresh. Neither route may substitute recursive `codex exec` helpers.
- The beta plugin cachebuster advanced to `0.3.0-beta.1+codex.20260717222507`. Both onboarding skills and both plugin packages validate. Web typecheck, production build, and the focused public agent-contract test pass on desktop and phone.
- Exact source commit `41766beb26e9fcfbf9d8f21c154cf428991b163a` is live as ChatGPT Sites version 18 (`appgdep_6a5aacbffb888191bdc735076ef02c72`). Production `/llms.txt` returns the permissioned automatic task handoff, manual fallback, and recursive-process prohibition.
