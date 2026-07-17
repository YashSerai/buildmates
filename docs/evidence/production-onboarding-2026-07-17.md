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

- The copied prompt is now only: `Set up Buildmates for me using the official guide: https://buildmates.yashns.chatgpt.site/install`.
- The live `/install` page and `/llms.txt` state that `get_setup_state` is the only setup-progress authority and that old conversations, tabs, routes, files, and prior task wording must not be used to infer resumable state.
- The plugin onboarding skill and plugin README carry the same rule. If the setup-state tool is unavailable, Codex must complete the official app connection rather than substitute browser history.
- The install page received the requested copy and UI/UX pass: one primary action, centered accessible prompt dialog, compact editorial hierarchy, phone-safe layout, manual app-link fallback, and a visible agent-instruction block.
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
