# Buildmates Architecture Plan

Date: 2026-07-14  
Status: ready for one-shot launch execution  
Product: Buildmates builder network  
Canonical feature spec: `docs/aegis/specs/2026-07-14-buildmates-product-design.md`

## 1. Architecture objective

Buildmates keeps private interpretation inside each user's Codex while the shared product owns identity, permissions, structured work data, deterministic retrieval, reciprocal state, relationships, messaging, generative-surface governance, moderation, and rendering. The product must survive a failed ChatGPT Sites MCP-hosting assumption without restructuring domain code.

## 2. Monorepo ownership

```text
apps/
  web/        ChatGPT Sites application and authoritative data APIs
  mcp/        Streamable HTTP MCP server and OAuth
packages/
  domain/     entities, policies, state machines, authorization, validation
  database/   schema, migrations, repositories, D1 adapter, service client
  surfaces/   SurfaceSpec, trusted components, sanitizer, Design Policy
  matching/   taxonomy, builder index, scoring, fixtures, evaluation contracts
  mcp-core/   one protocol/tool registry shared by Sites and external adapters
```

Root workspaces own shared TypeScript, lint, test, and build configuration. `apps/web` and `apps/mcp` import packages; neither imports the other's application internals. `packages/mcp-core` contains no deployment credentials or persistence implementation. A thin `apps/web` route adapter may mount it when Sites co-deployment passes; `apps/mcp` is the Worker/Vercel adapter. Both expose the same single tool registry and OAuth/resource-server contract.

## 3. Deployment topology

Primary topology:

- Buildmates web application: ChatGPT Sites.
- Buildmates MCP: ChatGPT Sites only if the complete transport/OAuth gate succeeds.
- Relational data: Sites-managed D1.
- Assets: Sites-managed R2.

Fallback topology:

- If ChatGPT Sites supports the production web contract, `apps/web` remains there even when MCP moves.
- If Sites cannot provide public reachability, stable authenticated sessions, required data bindings, or the secure internal service boundary, deploy the same `apps/web` contracts through the prepared Cloudflare Worker first or Vercel adapter and record the decision; do not ship a partial Site.
- `apps/mcp` deploys independently to a Cloudflare Worker or Vercel.
- The external MCP calls a narrow service-authenticated internal API in `apps/web`; it does not assume it can bind Sites-managed D1/R2.
- When the selected web host cannot bind Sites-managed D1/R2, use the database/asset adapter boundary to select Cloudflare-managed D1/R2 or a host-neutral production store rather than maintaining two data authorities.

The MCP public tool contract, domain state machines, schemas, and tests remain identical in either topology. The first substrate gate proves that ChatGPT Sites can deploy specifically from nested `apps/web`, resolve shared workspace packages, and provision `apps/web/.openai/hosting.json`. If that packaging shape fails, `apps/web` remains the source owner and a root deployment adapter is introduced; the monorepo is not collapsed.

When MCP is external, requests to the web data authority use a short-lived signed service assertion containing `iss`, `aud`, MCP OAuth `sub`, `jti`, `iat`, `exp`, tool/action, and scope. The web verifies signature, audience, expiry, replay, and scope, then resolves the active `identity_links` row itself. It never trusts a caller-supplied internal `userId`. Signing keys rotate, accepted keys are versioned, and the internal route is absent or disabled when MCP is co-deployed.

## 4. Website identity

Anonymous access is allowed for the landing page and owner-authorized public profiles, projects, cohorts, maps, and graph data.

Protected website routes use app-owned GitHub OAuth for the launch release. The server performs the authorization-code exchange, verifies GitHub's numeric account ID, maps it to a random internal Buildmates `userId`, and issues a hashed, revocable, HttpOnly session. Client state and caller-supplied `oai-authenticated-*` headers never authorize access.

The public gate separates anonymous reachability from authenticated subject quality. Anonymous reachability passed, while Sign in with ChatGPT subject authenticity failed, so the `IdentityProvider` boundary selects GitHub OAuth for the website. ChatGPT/Codex remains a separate MCP OAuth channel joined only by the explicit single-use linking code. The product does not run two implicit website identity systems or merge accounts by email.

Buildmates is its own MCP OAuth 2.1 authorization server/resource server using authorization code with PKCE. Authorization uses the active website `IdentityProvider`, but issues a stable, opaque MCP `sub` distinct from the web provider subject. Discovery, registered redirect URIs, authorization, token issuance/validation, refresh rotation, revocation, expiry, and audience are contract-tested. The opaque MCP principal has no Buildmates user-data authority until the explicit link completes.

## 5. Website-to-MCP linking

Website and MCP identities are explicitly linked:

1. The user signs into Buildmates web.
2. Web creates a short-lived random linking code and stores only its hash.
3. The user connects Buildmates from Codex and completes MCP OAuth.
4. MCP calls the narrowly scoped `complete_identity_link` operation while authenticated as its opaque MCP subject.
5. A single transaction consumes the code and creates the MCP identity link for the existing internal user.
6. Reuse, expiry, excessive attempts, subject conflicts, and cross-workspace misuse fail closed.

Core records:

```text
identity_links
  id
  user_id
  provider_channel      web | mcp
  provider_issuer       chatgpt_sites | github | buildmates_mcp
  provider_subject
  workspace_scope       literal global for the public MCP contract
  linked_at
  revoked_at?

identity_link_codes
  id
  user_id
  code_hash
  expires_at
  attempt_count
  consumed_at?
```

The database uniquely constrains normalized `(provider_channel, provider_issuer, provider_subject, workspace_scope)`, permits only one active link for that scoped subject, uniquely constrains `code_hash`, and consumes codes with compare-and-set semantics. The public MCP contract permits only the literal `global` scope until a safe multi-workspace authorization handoff is designed. The sole pre-link mutation is OAuth-authenticated `complete_identity_link`; it can only consume one code and create the corresponding link, is rate-limited, and exposes no user data. `get_link_url` is an OAuth-authenticated pre-link read. Every other user-specific MCP read and mutation requires OAuth plus a current identity link.

## 6. Mandatory agentic first run

The first Buildmates plugin run is a resumable state machine with a visible finish line:

1. Connect/link identity.
2. Explain what Codex may read and what Buildmates stores.
3. Identify permitted connected sources.
4. Collect enough builder context.
5. Review Work Signals and privacy.
6. Produce a basic structured profile.
7. Generate and preview the first page.
8. Configure the Networking Pulse.
9. Select Manual or Full Autopilot.
10. Configure automation cadence and source liveness.
11. Complete one useful outcome available in the current MCP contract: candidate, follow/watch, or invite.

Sparse context never blocks onboarding. Codex may ask adaptive questions, accept manual fields, let the user select one repository/project, accept a short pasted description, or inspect user-provided portfolio, GitHub, LinkedIn, and project links under permission. Required completion data is only identity/handle, short builder description, one project or active interest, privacy review, Networking Pulse, acceptance mode, and automation choice.

The state machine is owned by `packages/domain`; MCP exposes `get_setup_state` and idempotent `complete_setup_step`. Codex is the canonical first-run controller. The website reads the same D1-backed completion state and provides status, identity linking, preview/publishing, and an explicitly secondary manual fallback at `/onboarding/manual`; it never maintains a parallel onboarding record.

## 7. Connected-source boundary

Buildmates is the only required plugin. Codex and each provider retain connector credentials and host permissions. Buildmates source-use policies govern only Buildmates workflows.

Codex submits approved generic Work Signals. It never submits raw prompts, complete chats, documents, repositories, email bodies, calendar contents, or credentials. Local-device sources are visibly best-effort and record their last successful refresh.

## 8. Canonical taxonomy

Deterministic matching uses versioned normalized identifiers:

```text
topics
topic_aliases
topic_relationships
tools
domains
stages
collaboration_intents
```

Each Work Signal stores:

```text
taxonomy_version
canonical_topic_ids
canonical_tool_ids
canonical_domain_ids
canonical_stage_ids
canonical_collaboration_intent_ids
free_text_summary
```

Codex proposes classifications; the server accepts only existing identifiers or routes proposed additions for taxonomy review. Aliases such as “voice agents,” “conversational voice AI,” and “audio agents” resolve to the same or related canonical concepts. Problems and interests map to canonical topics, ambitions map to goal/collaboration-intent identifiers, communities map to governed cohort/community IDs, and project/profile/Networking Pulse fields use the same taxonomy/version contract as Work Signals.

## 9. Deterministic retrieval and user-side judgment

`builder_match_index` is a denormalized current snapshot per builder. It contains a monotonically increasing index version plus canonical work concepts, stage, intentions, timezone/location buckets, cohorts, freshness, preference flags, and exclusions. It rebuilds when that builder's approved inputs materially change or expire.

The deterministic scorer writes pair-score rows containing both builder-index versions, taxonomy version, weight version, feature components, evidence IDs, audience decisions, and total. Any input change invalidates all rows involving that builder; retrieval also rejects version mismatches and enforces expiry/block/visibility at query time even before a rebuild job runs. Eligibility and privacy filters run before ranking. The user's automation receives the top 20–30 viewer-authorized candidates and uses Codex to evaluate mutual relevance, rank the batch, and approve/decline/defer according to that user's preferences. Evidence the viewer may not see is omitted or reduced to a non-revealing reason code; match-private content is never leaked as component evidence.

GPT-5.6 Sol High is used during implementation and offline evaluation to design and adversarially test taxonomy, weights, fixtures, edge cases, and explanations. The production server does not run model inference. Luna High is recommended for recurring user automation; Luna Extra High may be recommended for complex profile/surface generation.

## 10. Reciprocal state and Full Autopilot

The database stores a stable unordered match pair plus immutable proposal attempts and side-specific evaluation/acceptance state. Manual and Full Autopilot are first-class:

- Manual/Manual: two agent approvals plus two Interested taps.
- Auto/Manual: two agent approvals plus the Manual person's tap.
- Manual/Auto: two agent approvals plus the Manual person's tap.
- Auto/Auto: two independent agent approvals.

The atomic match transition verifies that both authenticated actors evaluated the same current proposal, both evidence/index versions remain valid, the proposal is unexpired, neither side is blocked or paused, and the captured Manual/Full Autopilot plus capability requirements still pass. One transaction keyed uniquely by `match_pair_id` inserts the Connection, both Connection-side records, room, both room memberships, terminal proposal transition, notifications, and audit event. Unique constraints, idempotency keys, and the capability-proven D1 atomic primitive prevent duplicates.

## 11. SurfaceSpec security model

The trusted component tree is the primary profile/room/Circle format:

```text
SurfaceSpec
  theme tokens
  trusted component tree
  content bindings
  media bindings
  responsive rules
  optional decorative HTML/CSS regions
```

Interactive behavior, privacy, navigation, follow/connect/report actions, projects, chat, scheduling, trackers, and votes are trusted application components.

Decorative/editorial iframe regions:

- disable scripts, forms, same-origin access, popups, and top navigation;
- reject event handlers, `@import`, arbitrary `url()`, remote beacons, overlays, and unsafe protocols;
- load images/fonts only through approved R2 assets whose upload pipeline allowlists passive raster/font types, forbids HTML, rejects or sanitizes SVG, assigns a trusted `Content-Type`, sends `X-Content-Type-Options: nosniff`, and serves from a non-executable asset origin/policy;
- receive only server-resolved bindings the current viewer may access;
- cannot call authenticated APIs or write product data.

Every revision stores base version, Design Policy version, author, approvals, history, and rollback information.

## 12. Messaging, events, and automation

Day-one chat uses D1 persistence and bounded polling with pagination, optimistic sends, idempotent client IDs, unread checkpoints, retries, and explicit error states. `MessageRepository` permits a later real-time transport.

Immediate in-app events do not wait for scheduled automation: invitations, match acceptance, messages, Calendar proposals, Circle invitations, reconnect requests, moderation, and security events enter the authenticated Site inbox immediately.

Codex automation performs private intelligence: Work/Networking Pulse refreshes, candidate evaluation, renewed relevance, feedback prompts, upgrade proposals, and digests. Local project sources require the device/app to be available; hosted connectors may run remotely when supported.

## 13. Optional Codex and Calendar handoff

Scheduling offers four paths:

1. Continue in Codex through a capability-verified `codex://` deep link.
2. Copy a ready scheduling prompt.
3. Propose/accept/counter times inside Buildmates.
4. Download ICS.

In the Codex path, Buildmates prepares authorized context, Codex invokes the Calendar app, the user confirms under provider rules, and Codex attaches only a minimal event receipt. Calendar is an enhancement, never a core-build blocker.

## 14. Neutral functional UI phase

The first implementation phase uses a clean neutral component system. It must have correct information architecture, responsive behavior, accessibility, navigation, focus, loading/empty/error/stale/permission states, and functional controls. It must not contain placeholders, fake metrics, template filler, or inaccessible defaults.

Deferred until the product is feature-complete and production-ready under the neutral UI:

- final landing-page art direction and marketing polish;
- final brand identity, animation, and signature motion;
- custom-profile aesthetic exploration beyond the functioning generator;
- final globe/graph visual styling;
- decorative room/Circle art direction.

The later visual phase reuses the stable component and SurfaceSpec contracts rather than changing product behavior.

## 15. Continuous launch-validation program

The checks remain ordered for evidence, but they are not user handoff points. The implementation run performs each check as soon as its owning surface exists, repairs failures or selects the documented adapter fallback, and continues through production release.

Platform and identity checks:

1. Deploy nested `apps/web` as a public ChatGPT Site, prove anonymous non-owner reachability, shared-workspace resolution, D1, and R2.
2. Prove a stable authenticated subject for a public non-owner; activate GitHub OAuth only if the Site is reachable but SIWC subject/auth behavior fails.
3. Prove private object-level authorization between two test users using a minimal capability record.
4. Test the thin Sites MCP adapter. If transport/OAuth fails, deploy `apps/mcp` externally and prove the signed, replay-protected, subject-resolving web data boundary. Connect the selected MCP path through OAuth.
5. Explicitly link website and MCP identities with a single-use code, including the OAuth-only pre-link exception.

Product vertical checks:

6. Install/connect the plugin from a clean external-style account.
7. Submit a Work Signal from a real Codex session.
8. Run an unattended automation that calls Buildmates.
9. Determine whether consequential MCP writes work unattended or require approval and persist the capability state.
10. Atomically create one Connection and room under concurrent requests.
11. Publish and roll back a generated SurfaceSpec.
12. Test message polling in two independent sessions.
13. Test the website-to-Codex deep link separately.
14. Test Google Calendar capabilities; if unavailable, confirm prompt/manual/ICS fallbacks.

Checks 1–12 must pass under the selected production topology before release. A failed Sites deployment or MCP co-deployment chooses the prepared Cloudflare/Vercel adapter rather than ending the run. Check 13 may resolve to copy/manual handoff, and check 14 may resolve to manual/ICS scheduling. The only interruption boundary is an irreducible human/account action such as separate-account approval, CAPTCHA/2FA, missing owner permission, or unavailable credential/billing authorization.

## 16. Security invariants

- No identity matching by email/name across auth boundaries.
- No MCP user data without OAuth plus an active identity link; the only pre-link write is atomic code consumption through `complete_identity_link`.
- No external MCP delegation by caller-supplied `userId`; the web authority resolves a signed MCP subject and rejects replay.
- No generated JavaScript or authenticated iframe access.
- No unauthorized field in HTML, JSON, metadata, graph, search, or MCP output.
- No connector credentials in Buildmates.
- No production matching inference in the Buildmates backend.
- No one-sided agent approval on behalf of another user.
- No duplicate Connection/room under retries or races.
- No stale pair-score use after input, taxonomy, weight, visibility, expiry, pause, or block changes.
- No private graph edge without every represented member's approval.
- No Calendar dependency for core scheduling.

## 17. Architecture approval boundary

Saying `go` authorizes continuous implementation of the monorepo, deployment adapters, identity linking, domain/data contracts, neutral functional UI, full feature plan, Git/GitHub release work, production deployment, browser/computer testing, and repair cycles through launch readiness. Internal checks do not require renewed approval. This does not finalize the later bespoke visual-brand phase; that begins only after the neutral product is complete and production-ready.
