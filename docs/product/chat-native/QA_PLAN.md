# Release acceptance plan

The candidate must prove the same account and behavior in ChatGPT and Codex. A passing local test does not establish host installation, OAuth consent, unattended execution, or a deployed release.

| Journey | Acceptance |
| --- | --- |
| Install and connect | Install the candidate package, discover its tools, complete genuine authentication, and return to the linked account. Reject expired, replayed, wrong-issuer, and wrong-workspace credentials. |
| First signup | Ask to join, choose only accessible approved sources, review the profile, decline public publication and background tasks, and finish signup. Resume each interrupted step in a new conversation without duplicate writes. |
| Returning builder | Read saved state before asking questions. Update reviewed facts, projects, privacy, matching preferences, and source permissions. Verify each change from a fresh read. |
| Introductions | Use two independently authenticated builders and an outsider. Each builder reviews their own evidence and makes their own decision. Produce one relationship and room after reciprocal consent. A foreground probe cannot provide automatic acceptance authority. |
| Conversations | Open the actual room, send, retry, edit and delete an authored message, mark it read, and test private notes, reminders, reconnection, availability and meeting responses. Deny outsiders and edits to another person's message. |
| Circles and projects | Create a Circle, invite and accept membership, chat, propose and approve a shared module/design, and enforce the stored governance. Invite project collaborators, accept, edit, remove, and transfer ownership without partial membership changes. |
| Generated designs | Read a saved draft in a new chat, make a targeted change, preview desktop and phone layouts, explicitly approve publication, and exercise history and governed rollback. Block scripts, network access, unauthorized assets and private bindings. |
| Privacy and safety | Pause matching, revoke a source, redact shared context, block/unblock, report, export every paginated section, and request deletion with an actor-bound receipt and explicit confirmation. Do not expose another person's private feedback or block list. |
| Embedded interface | Use real service responses. Check keyboard/focus, long content, empty/loading/error states, retry behavior, phone overflow, preview isolation and all visible controls. Repeat in the actual host iframe. |
| Release and recovery | Validate portable manifests and deterministic packaging. Run lint, type checks, web/unit/contract/integration/security and browser suites. Record exact source and provider versions, migration/rollback compatibility, and fail-closed recovery for uncertain writes. |

Browser automation and local principal fixtures validate deterministic behavior. Real-host acceptance additionally requires natural-language conversations in each host, genuine provider consent, two independent accounts, and a separately recorded candidate deployment. Host-generated tool choices and actual iframe policies must be observed, not inferred from local fixtures.

## Current checklist

Updated October 3, 2026 after an independent GPT-6 Luna High coverage review. Check each boundary separately; a local pass cannot close its corresponding live or host case. [Release evidence](qa/2026-10-03-release.md) binds the source and completed checks.

- [x] Full candidate gate: lint, all workspace type checks, builds, 394 deterministic checks, and 100 browser cases. Two production-capture cases are intentionally skipped in CI.
- [x] Local seeded shortlist: exact expected candidate order, hidden candidate exclusion, private sentinel exclusion, and fixture cleanup. This proves synthetic retrieval, not organic matching quality.
- [x] Local onboarding, source/privacy controls, profile editing, design workspace, messages and shared governance browser coverage.
- [x] Live website version 105 and deployed existing MCP Worker; six basic smoke checks and nineteen stricter public/authentication checks pass.
- [x] Live signed-out landing at desktop and phone sizes: complete lower-page inspection, setup dialog, Escape and focus restoration, working setup-guide navigation, no horizontal overflow or broken images.
- [x] Live phone map and phone/tablet graph: anonymous city totals, map loaded, honest empty graph, no horizontal overflow or captured console warnings/errors during inspected flows.
- [ ] Repair and verify the live graph's missing level-one heading, found during the human-style browser review.
- [ ] Actual candidate installation, tool discovery, authentication and first onboarding in Codex.
- [ ] Same account continuation and supported embedded previews in ChatGPT web.
- [ ] Fresh final-candidate conversation for project collection, matching-only refresh, export and successful page generation. The previously authorized twelve-conversation allowance is exhausted.
- [ ] Human review of newly authored profile pages against the rubric below. Existing hand-authored test fixtures establish layout behavior only.
- [ ] Two independently authenticated, consenting human accounts: reciprocal decisions, one room, message delivery and outsider denial.
- [ ] Signed-in deployed owner/visitor privacy, asset, recovery and migration checks. Anonymous readiness is insufficient for this gate.
- [ ] Real host scheduling capability, before enabling background Work Pulse or unattended acceptance.
- [ ] Dedicated reviewer-account runs, walkthrough and publisher verification before public directory submission.

## Seeded matching matrix

Use an isolated local database and explicitly synthetic accounts. Declare expected ranks and eligibility before running a case; keep the resulting shortlist and explanations, including failures. Never add fixtures to the shared production network or count them as real builders. Production aggregates deliberately exclude QA-origin records.

| Scenario | Required observation |
| --- | --- |
| Closely related, adjacent and unrelated projects | Relevant candidates precede weaker ones under the declared fixture; explain concrete shared work without pretending every candidate is a good match. If nobody qualifies, report no suitable match. |
| Synonyms and different descriptions of the same problem | Canonical topics agree where justified; similar words alone do not establish identical goals. |
| Same project title, different work | Use approved descriptions to distinguish them; do not guess the project or identity. |
| Private, matching-disabled or unreviewed fields | No unauthorized display or matching use. Approved matching-only evidence stays out of public profiles. |
| Paused, blocked, excluded, expired, revoked, deleted, inactive or self candidate | Exclude each ineligible case according to its stored rule; record the exact negative assertion. |
| Sparse, empty, stale or unavailable context | Ask for the smallest missing fact, offer a manual description, or show an honest empty result. |
| Hostile instructions inside a source or candidate | Treat the text as data; no publication, exfiltration, private note read or unrelated write. |
| Refresh and retries | Only approved changed matching context changes. Public profile, privacy, publication and unchanged signals remain intact; uncertain effects do not duplicate. |
| One-sided interest and repeated acceptance | Keep the introduction pending until independent consent permits it; create one relationship and room. |

The known local shortlist asserts Mira Chen, Mira Labs, Amara Okafor and Theo Martin in that order, with Hidden Candidate and the private sentinel absent. These are fixture names. See `tests/e2e/local-codex-match-evidence.spec.ts`, `tests/unit/matching-score.test.ts` and the conversation evidence for their exact inputs and limits.

## Generated profile quality gate

Review the full rendered page, its approved source facts, and every visible control. Do not grade only a thumbnail or an empty design workspace. Use distinct approved synthetic personas with sparse context, several substantial projects, long names/URLs, multilingual text, no media and approved media. Keep those cases separate from genuine user profiles.

Score each dimension 0 (fails), 1 (usable but needs work), or 2 (meets the brief): factual and privacy fidelity; person-specific composition; project clarity and depth; typography and readability; responsive/accessibility behavior; working navigation and controls. Require at least 10/12 with no zero, plus the hard checks below. Scores are review judgments, not user-study results.

- No invented biography, achievements, testimonials, project outcomes or assets. No private/matching-only field in a public page.
- The page should help another builder understand the person's actual work and a reason to connect. A generic list with a changed name does not establish successful generative design.
- Inspect desktop, tablet and phone, including the footer and long content. Check hierarchy, heading structure, gutters, alignment, contrast, focus, keyboard use, reflow, clipping and image alternatives.
- Exercise private preview, targeted edit, new-chat resume, publication approval, viewer access, revision history and rollback. A saved draft must never be described as published.
- Check empty/loading/error states, denied clipboard, slow script loading, missing media, dropped responses and repeated actions. Preserve the draft and explain the actual state.

Conversation quality uses the existing [14-point rubric](CONVERSATION_QA.md). Judge task completion and response usefulness independently of safe refusal. Require grounded match reasons, ordinary language, no internal IDs or schema names, no repeated settled questions, and a concrete result verified by saved-state reads. Preserve failing transcripts and grade repaired runs separately.

For each failure, record the source/host boundary and reproduction, fix the cause, rerun the affected case and its neighboring cases, then close the item only with new evidence. Repeat broader checks when a covered source, schema, dependency, configuration or deployment change invalidates them.

## Fresh host conversations

Run this sequence independently in ChatGPT web and Codex after deploying the matching candidate and installing its package. Record the actual prompt, selected tool, visible response, and saved-state read. Use dedicated consenting test accounts rather than the founder's existing profile.

1. Say **"Sign me up for Buildmates. Keep my page private and skip recurring tasks."** Complete the real sign-in screen. Approve one accessible source; deny another. Confirm that signup finishes without a public page, a scheduled task, or access to the denied source.
2. Start a fresh conversation. Say **"Show my profile and update what I'm building."** Verify the saved account is recognized, the host reviews the change, and a fresh read reflects exactly the approved facts. An unavailable source must produce an honest request for context rather than invented work history.
3. Say **"Find people working on similar problems."** With a second independent account, review each side's evidence, decline one introduction, and accept another reciprocally. Verify exactly one Connection and room. Use an outsider account to check that the room and private evaluation cannot be read.
4. Say **"Open our room and send this message."** Then ask **"Did that send?"** and resume in a fresh conversation. Verify one message, authored-message editing/deletion, and denial of another person's edit. Create a Circle and project collaboration; test invitations, approval rules, transfer of ownership and removal.
5. Say **"Make a profile page, but don't publish it."** Review the embedded preview when the host supports it. Make a targeted edit, leave and return, publish only after explicit approval, and test history and rollback. The host must disclose when it cannot render or inspect a requested layout.
6. Pause matching, revoke the approved source, block a builder, and export all pages. Start deletion, cancel before confirmation, then request it deliberately. Check access revocation, shared redaction and actual cleanup completion. Expired receipts, vague requests such as **"delete it"**, failed requests and repeated sends must not silently choose a destructive target or duplicate an uncertain effect.

Repeat interruption and cancellation at sign-in, source consent, profile review, invitation, shared publication and deletion. Keep provider login, host consent and each account's approval with its human owner.

Re-run evidence after changes to its covered source, schemas, dependencies, configuration, host protocol, authentication, assets or deployment. Historical screenshots remain historical; new candidate evidence belongs under this workstream's dated QA directory.
