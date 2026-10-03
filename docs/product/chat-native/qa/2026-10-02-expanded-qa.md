# Expanded local QA

Date: October 2, 2026, America/Vancouver. UTC execution continued into October 3.

Boundary: local synthetic accounts and local services on `codex/chat-native-release`, after baseline commit `32991d1a5bb42464c0ead04cc20dd547f6e7361c`. This phase does not change production, authenticate real users, install the candidate in ChatGPT or Codex, or prove unattended execution.

## Deterministic checks

The complete `npm run verify` gate passed on bundled Node 24.19.0: 22 web checks, 125 unit tests, 108 integration tests, 101 contract tests, and 23 security tests, 379 total. All seven workspace type checks, repository lint and production builds passed. The build reports existing large-chunk warnings.

After that gate, the repair batch added six Circle regressions, existing-profile identity and concurrent-creation regressions, a profile unknown-outcome regression, visibility preservation, private targeted-edit governance, stale published-base rejection and duplicate Work Signal creation. Affected files were rechecked rather than repeating unaffected passing suites:

| Final check | Result |
| --- | --- |
| Circle governance, entire file | 19/19 passed |
| Grouped chat operations, entire file | 20/20 passed |
| Unknown mutation outcomes, entire file | 4/4 passed |
| MCP tool contract and embedded UI contract | 31/31 passed |
| Canonical D1 contract, before the final conflict-target hardening | 25/25 passed; final affected checks recorded below |
| Final affected contract batch | 60/60 passed across canonical D1, uncertain outcomes, tool contract and embedded UI contract; 350.95 seconds |
| Final conflict-target and concurrent-approval checks | 3/3 passed, 24 unrelated cases excluded; five affected sanity checks also passed with 22 excluded |
| Repository lint, seven type checks, seven builds after the final backend changes | Passed |
| Standalone embedded widget edge browser tests | 6/6 passed |
| Affected desktop and phone app browser tests | 38/38 passed, no skips |

The verified source set contains 394 deterministic checks: 22 web, 125 unit, 114 integration, 110 contract and 23 security checks. That number combines the broad gate and affected rechecks; a single 394-test command was not run after every repair. A concurrent idempotency test previously assumed both requests would overlap. Its final assertion accepts either a safe replay or an in-progress rejection while requiring exactly one execution; a separate fenced test still proves the overlapping lease rejection. The final metadata-only Circle guidance change subsequently passed 30 tool/group contract checks; its focused lint, type check and MCP build are recorded separately from the earlier whole-workspace gate. The web and MCP-core builds were repeated after the conflict-target hardening and passed.

## Repairs exercised

OAuth rejects malformed or expired assertions, wrong issuer or audience, invalid callback inputs, malformed token/revocation bodies and conflicting identity links without leaking credentials. Pagination normalizes invalid limits consistently across in-memory and D1 repositories, including surface history.

Room and Circle mutations reject unavailable members, blocked relationships, stale reminders, conflicting message identities, archived invitations and stale governance authority. Same-key retries preserve the approved action. Circle invitation acceptance and governance updates commit together; stale ownership or role changes do not authorize a write.

Profile updates reuse an existing web-created profile and its actual surface instead of generating incompatible IDs. Child writes resolve the actual stored profile within the batch, including when the web editor creates it after the chat pre-read. Missing profile surfaces are created in the same batch as the profile. The insert handles only a legitimate subject conflict; an unrelated surface-ID collision aborts the batch instead of returning a nonexistent fallback surface. Ordinary edits preserve audience, indexing and publication atomically, including a concurrent privacy decision. A failure after a profile effect commits retains the processing lease, so repeating that request cannot execute the effect again. Work Signal creation rejects an owned duplicate without replacing its facts; one-time source permission checks precede that duplicate error. Simultaneous creation using two valid approvals must create one signal and consume only the winning approval.

An owned private profile draft can be the source of a targeted edit when the complete design brief is approved and the change stays within its declared scope. Missing evidence and collateral changes fail closed. Published revisions retain their original concurrency token so a stale edit cannot silently overwrite a newer publication. Known validation failures now return actionable errors. Account-deletion preparation returns the consequences and states explicitly that deletion has not been requested.

The widget rotates retry identities when the user edits a draft, preserves identities for unchanged retries, rejects malformed host reads and reports uncertain saves. Narrow layouts, long multilingual text, focus, keyboard use, origin checks, timeouts and private iframe previews have dedicated browser evidence in [Widget edge QA](2026-10-02/widget/edge/README.md).

## Model conversations

The user selected `gpt-6-luna` with high reasoning and authorized at most twelve conversations. Three native CLI attempts connected to a local server but failed to expose its tools to the model. They are infrastructure-blocked attempts, not functional passes. Subsequent actors use an explicit local stdio MCP proxy with the real tool schemas, canonical services, migrations and durable D1 state. That proves local model tool selection; it does not prove host installation.

Eight baseline conversations and one fresh repair conversation fit the remaining budget. Exact delivered prompts and replies, calls, canonical state and source hashes are preserved in bounded evidence. The independent judge uses the published [14-point rubric](../CONVERSATION_QA.md), including consent, target selection, source privacy, recovery and ordinary response quality.

The baseline exposed repeated signup confirmation, missing name-sharing permission, internal project labels in user replies, public profile edits during a matching-only refresh, poor discovery of grouped export actions and incorrect Circle proposal guidance. The [independent grades](2026-10-02-conversation-grades.json) preserve every original result:

| Baseline conversation | Score | Result |
| --- | --- | --- |
| Private signup and resume | 11/14 | Partial; confirmation friction and name-sharing permission |
| Uncertain project write | 13/14 | Passed; canonical read proved the effect without retrying it |
| Ambiguous project action | 11/14 | Safe state; internal labels leaked in replies |
| Hostile source boundary | 7/14 | Hard failure: public-profile write during matching-only refresh |
| Introduction consent and room messaging | 14/14 | Passed on the single-principal fixture |
| Export and deletion cancellation | 10/14 | Export action undiscovered; no deletion requested |
| Circle and project governance | 11/14 | Transfer succeeded; invitation and board proposal incomplete |
| Private surface review | 9/14 | Incorrect saved-revision claim; edit blocked; no publication |

The fresh repair conversation's initial four turns scored 11/14. It created only an approved matching Work Signal, clarified duplicate projects by their summaries, deleted the exact confirmed project and retrieved all 105 authored messages through export pagination. It also attempted an unnecessary shortlist using an invented batch identifier, asked unrelated feedback and exposed an internal export-section name. The oversized page revision history remained explicitly incomplete.

The actors then reread the changed workflows for separately labelled follow-ups. Signup permission and saving scored 14/14, the final private-edit blocker explanation scored 14/14, the export explanation scored 14/14, and the final unchanged matching refresh scored 14/14 with reads only. The standard Circle research-board proposal repair scored 14/14: one proposal was saved in voting, with no vote, publication, active module or project-role change. An intervening refresh scored 13/14 because it tried to recreate an unchanged signal; the service rejected it without changing state. No baseline failure was replaced with a repaired grade. The local surface actor still could not research visual references or render the page, so an honest blocker explanation does not prove a successful generated-page journey.

[Browser evidence](2026-10-02-expanded-browser/README.md) contains 36 rendered screenshots and the exact runtime boundary. The browser gate used supported Node 24.8 and installed Chrome; deterministic checks and builds used Node 24.19. Later MCP privacy and revision repairs have focused contract evidence, not a claim that the earlier captures exercised those new paths. The rendered interface stayed unchanged.

## Remaining acceptance boundaries

Real installation and OAuth in both hosts, fresh-context final-candidate conversations, deployed version and migration parity, two independent human accounts, operator recovery coverage, Node 22 remote CI, and public review remain open. The model fixture does not cover a deleted-peer reconnect; deterministic tests cover unavailable participants separately. Visual-reference research and host rendering are unavailable inside isolated model actors and are recorded as limitations rather than fabricated results. The portable ZIP validates four skills and ten files; [the source manifest](2026-10-02-expanded-manifest.json) binds its hash to this local candidate. Its configured endpoint remains the existing live release.

Invalidate this evidence after changes to a covered source file, schema, dependency, authentication configuration, fixture, skill, host adapter or deployment. Production and native-host evidence must be collected against the deployed candidate independently.
