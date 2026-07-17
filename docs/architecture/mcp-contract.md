# Buildmates MCP contract

## Runtime boundary

Buildmates exposes one transport-independent registry from `packages/mcp-core`. The external Worker mounts it through Streamable HTTP. The Sites adapter remains an explicit 501 capability result until Sites proves the complete OAuth/streaming contract; it does not carry a second or reduced registry.

For the selected external topology, each linked tool call uses a 60-second RS256 assertion containing issuer, audience, opaque MCP subject, exact action `tool.execute:<tool>`, exact scope `mcp:tool:<tool>`, the tool name, a canonical SHA-256 hash of the complete input, issue/expiry times, key ID, and a one-use `jti`. The web authority recomputes the input hash, verifies every exact binding before consuming the `jti`, resolves the active `(buildmates_mcp subject, workspace scope)` identity link, and executes the same registry against its D1 binding. Neither the Worker nor tool input supplies an internal `userId`.

The D1-backed MCP repository writes the canonical Task 3 product tables: connected-app preferences, Work Signals, profiles and handles, Networking Pulses and controls, invitations, matching and relationship aggregates, rooms and Circles, automation checkpoints, and Calendar receipts. Setup state and one-use source approvals are first-class narrow tables. Surface revisions, approvals, personal views, publication, and rollback route through the Task 4 repository and Design Policy. There is no generic JSON product-record table or second product authority.

Caller-selected IDs are always namespaced deterministically by the linked internal user, even when their text resembles a canonical ID. An exact stored ID is accepted only after the canonical repository proves that actor may use that stored object in that operation. D1 idempotency never steals a `processing` lease based on wall-clock expiry because the original runner may still commit effects. Known caught failures are marked `failed` and retry immediately; completed results replay and changed hashes conflict. A crashed unknown runner remains blocked for explicit operator recovery. Recovery uses the authenticated, same-origin Site operator route and canonical Sites D1 binding; the server derives an active administrator identity and a completed disposition additionally proves that the operation-specific canonical effect belongs to the recorded actor. Safe criteria live in `docs/runbooks/idempotency-recovery.md`; live owner-database proof remains a deployment gate. The memory adapter keys records by owner, coalesces identical concurrent work on one promise, and clears caught failures for retry.

## Identity and first run

Every request requires a valid OAuth bearer with an opaque `mcp_sub`. Exactly two tools work before an active web identity link:

- `get_link_url` returns the HTTPS web sign-in/approval page and no user data.
- `complete_identity_link` is rate-limited and can only atomically consume a short-lived code for the current principal and workspace scope.

`get_link_url` opens the authenticated `/settings/connections` page. That page shows current connection state, explains the privacy boundary, creates a rate-limited ten-minute single-use code only after explicit approval, polls for completion, and supports user-scoped disconnection. It never renders provider subjects or connector credentials.

After the link resolves, setup state automatically records `identity_link` complete. The remaining visible sequence is storage explanation, source selection, context collection, signal/privacy review, basic profile, page preview, Networking Pulse, acceptance mode, automation, and one real useful outcome: a canonical candidate batch, active follow/watch, or invite. Writes are ordered and idempotent; the state is resumable from web or Codex.

Sparse setup accepts focused answers, a manual profile, one repository/project, a pasted description, or portfolio/GitHub/LinkedIn/project URLs. Rich setup can use user-approved connected context. Neither branch invents facts or requires optional details.

## Source and data boundary

Source discovery is deliberately non-exhaustive: confidently visible apps in the current conversation, declared optional dependencies such as Google Calendar, and user-named sources. Policies are per-source and Buildmates-only: `never`, `ask_each_time`, `allow_approved_work_signals`, and `actions_only`. These values never alter ChatGPT or provider permissions.

Strict Zod objects are passed intact to the MCP SDK, so unknown keys are rejected at both direct-execution and transport boundaries. Work Signals contain only an approved summary, source label, taxonomy version/canonical identifiers, audience, matching flag, and expiry. `never` and `actions_only` sources cannot submit signals. `ask_each_time` requires a short-lived, single-use approval; the canonical Work Signal row uniquely binds that approval so reuse stays impossible even if a follow-up receipt update fails. There are no credential, raw-prompt, transcript, document, repository-content, email-body, or calendar-content fields. Connector text remains inert evidence and cannot change policy, approve itself, select an actor, or mutate another user.

## Public tools

The 35-tool registry covers:

- linking: `get_link_url`, `complete_identity_link`;
- setup and sources: `get_setup_state`, `complete_setup_step`, `get_source_preferences`, `save_source_preference`;
- current work and identity: `list_work_signals`, `submit_work_signal`, `get_networking_pulse`, `update_networking_pulse`, `get_profile_model`, `update_profile_model`;
- growth/discovery: `create_invite_link`, `revoke_invite_link`, `set_follow_or_watch`, `get_candidate_shortlist`;
- reciprocal matching: `record_candidate_evaluation`, `record_manual_match_response`;
- relationships: `get_connections`, `update_connection`, `save_connection_private_note`, `get_connection_private_notes`, `schedule_connection_reminder`, `get_connection_reminders`, `get_room_summaries`, `get_circle_summaries`, `submit_intro_feedback`;
- generated surfaces: `get_surface_generation_brief`, `submit_surface_revision`, `decide_surface_revision`, `rollback_surface`;
- scheduling: `prepare_calendar_handoff`, `attach_calendar_event`;
- automations: `get_automation_checkpoint`, `update_automation_checkpoint`.

All linked mutations require idempotency keys. Evaluation, manual response, revision decisions, rollback, and Calendar attachment carry explicit confirmation inputs and consequential metadata. Collection reads use opaque ID cursors, default to 20 records, reject limits above 50, and return `nextCursor`; note and reminder pages apply Connection scope before cursor/limit. D1 uses direct indexed list queries rather than ID fan-out, and taxonomy sets use at most one bounded query per taxonomy table. Calendar preparation is read-only and audience-filtered. Calendar attachment accepts only a provider-confirmed minimal receipt: provider label/event ID, start/end, participant labels, and status.

The public MCP contract accepts only the literal workspace scope `global`. Arbitrary workspace identifiers fail validation and cannot be linked or resolved until a separately designed, authorization-safe multi-workspace handoff exists.

Follow/watch mutations return a canonical relation key (`follow|watch:target-kind:target-id`). D1 reads and lists resolve only that linked user's active row and exclude any row with `revoked_at`; a disabled mutation returns its revocation receipt but cannot satisfy setup evidence. Connection updates round-trip mute, renewed-relevance preference, and acknowledgement time from `connection_sides`. The only relationship-state mutation exposed here is `ended`; reactivation requires the separate mutual reconnect state machine planned for Task 10.

Surface generation briefs fail closed unless D1 can derive the active Design Policy trusted components, subject-specific allowed modules, server-resolved binding identifiers, and current governance. Profile briefs name the owner approver; room briefs enumerate active members and unanimous approval; Circle briefs derive admin publishers or strict-majority voters from current membership and governance version. Surface submission uses the hardened Task 4 `safeParseSurfaceSpec` parser and active immutable Design Policy. Revision visibility is explicit canonical data. Personal views have no member-reader list, are readable only by their author, and cannot be approved, published, or used as rollback targets. Shared-revision approval authority is derived from the parent Surface rather than copied reader metadata. Shared room revisions publish only after every active member approves; Circle admin/vote rules remain canonical. Rollback rejects nonexistent bases, creates a new audited private-preview revision, and returns its exact ID plus `published`, `pending_member_approvals`, `pending_admin`, or `pending_circle_vote`. Vote-governed Circle rollbacks create a current-governance design proposal bound to that revision and collect votes through the canonical Circle repository.

## Deployment and registration

The external Worker needs these Task 2 variables: `OAUTH_ISSUER`, `MCP_RESOURCE`, `OAUTH_CLIENTS_JSON`, `WEB_BASE_URL`, `WEB_DATA_URL`, `WEB_AUTHORIZATION_ISSUER`, `WEB_AUTHORIZATION_AUDIENCE`, and `MCP_DELEGATION_KEY_ID`. Its secrets are `OAUTH_SUBJECT_SECRET`, `OAUTH_DCR_SIGNING_SECRET`, `WEB_AUTHORIZATION_PUBLIC_KEY_PEM`, and `MCP_DELEGATION_PRIVATE_KEY_PEM`.

The web deployment needs `MCP_TOPOLOGY=external`, `MCP_DELEGATION_PUBLIC_KEY_PEM`, and matching delegation issuer/audience values. Apply D1 migrations before enabling the registry route. OAuth clients must use exact registered redirect URIs and resource audience. The beta MCP supports stateless dynamic registration only for exact HTTP loopback IP redirects, requires PKCE S256, binds registration metadata in a signed client ID, rate-limits registration and authorization handoffs, and shows an explicit website consent screen before issuing a code.

`plugin/.codex-plugin/plugin.json` references only `plugin/.app.json`; there is no `.mcp.json` or direct `mcpServers` registration. Until ChatGPT creates the real app, `.app.json` truthfully has no app entry. Set the returned `asdk_app_*` or `connector_*` value as `BUILDMATES_APP_ID` and run `node plugin/scripts/bind-app-registration.mjs`. The binder rejects synthetic IDs. App creation and clean-account connection are account-side release checks, not values inferred in source.

## Verification

`npm run test:contract` covers SDK registry/annotations, transport-level unknown-key rejection, every-tool unlinked gating, malformed-input rejection, pagination bounds/cursors, Connection-scoped pages, expired/reused link codes, source-policy enforcement, lossless profile/Pulse/automation round trips, malicious canonical-looking caller IDs, follow/watch identity/revocation parity, no-steal slow-runner behavior, conditional operator recovery/audit, bounded expiry cleanup, legacy access-mode migration, canonical D1 row creation, real setup evidence, and truthful profile/room/admin-Circle/vote-Circle Surface briefs and governance. The platform integration suite additionally rejects delegated assertions replayed against another tool or altered input.
