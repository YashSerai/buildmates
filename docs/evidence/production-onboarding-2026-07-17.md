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

## Install-page audit follow-up

The public `/install` page needs a focused copy and rendered UI review after the active functionality run. This is logged as an audit requirement rather than a diagnosed defect until screenshot-led review identifies specific copy, hierarchy, spacing, responsive, or interaction failures. The audit must preserve one canonical setup prompt and the official app/guide handoff.

## Next verification sequence

1. Continue the current task from `2/11` and judge it only as a resume-path run.
2. Capture any divergence at each remaining step without repairing production mid-run.
3. Complete a true production data and identity reset.
4. Re-run the copied prompt and require `0/11` with `identity_link` next.
5. Repair the acquisition/onboarding instruction gaps and `/install` copy/UI findings, then repeat the affected checks.
