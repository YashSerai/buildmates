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
