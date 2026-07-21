# Buildmates Product Specification

Date: 2026-07-14  
Status: approved planning direction; implementation pending  
Category: OpenAI Build Week — Work and Productivity  
Product line: Meet people through what you build.

## 1. Product definition

Buildmates is a Codex-native builder network that introduces people through the work they are doing now. It supports friendship, community, peer discovery, collaborators, cofounder exploration, hiring, and natural professional relationships without reducing people to résumés. It replaces cold, static networking with an opt-in loop:

1. Codex reads only the connected-app context a user permits in the current conversation.
2. Codex turns relevant context into concise, privacy-safe Work Signals.
3. Buildmates shortlists compatible people with deterministic logic.
4. Each person's Codex independently evaluates the proposal for that person.
5. The users' chosen acceptance modes determine whether a tap is required.
6. Reciprocal approval creates a lightweight chat room themed around the actual connection reason.
7. Post-conversation feedback improves future matching and may unlock an optional room upgrade.

The wedge is not another professional profile. It is networking on autopilot through current work, with the user's Codex acting as a private context interpreter and relationship agent.

## 2. Product principles

### Current work over static identity

Profiles may contain stable background, but matching emphasizes active projects, interests, ambitions, location, communities, stage, and current areas of exploration. A person building retrieval infrastructure may find another retrieval builder interesting because their approaches, stages, or ambitions overlap even when neither person has a specific problem to solve.

### Mutual relevance over popularity

A connection should be interesting to both people because their current work, interests, ambitions, location, communities, or stage overlap. Neither person needs to have a problem the other can solve. Offers and needs are optional relevance signals, not requirements. Global follower counts, attractiveness scores, token consumption, and engagement leaderboards do not drive ranking.

### Codex interprets; Buildmates coordinates

The user's Codex performs private context reading and judgment. Buildmates stores approved summaries, runs deterministic retrieval, coordinates consent, and renders shared spaces. Day-one Buildmates infrastructure does not perform paid model inference.

### Progressive depth

The first interaction is intentionally light. A room becomes a richer workspace only after the people have evidence that the relationship is useful.

### Generative expression with stable behavior

Codex can produce a profile or room with a strong individual visual identity. Authentication, permissions, messages, calendars, trackers, votes, and data writes remain stable application primitives.

### Privacy is a visible product feature

Users can see every approved Work Signal, its source label, its expiry, and its matching audience. Work Signals are never public or publicly searchable. Publishing current work is a separate, explicit profile or project-update action. Deletion and revocation are real operations.

## 3. Primary actors

- Builder: creates a profile, permits Work Signals, receives matches, and joins rooms.
- Circle member: participates in a small group created through related reciprocal connections.
- Circle admin: manages membership and publishes or routes shared design proposals.
- User-side Codex automation: performs Work Pulse extraction, evaluates shortlists and inbound proposals, gathers intro feedback, and proposes upgrades.
- Buildmates MCP app: provides tools for reading permissions, submitting approved summaries, retrieving candidates, recording evaluations, and managing surfaces.
- Buildmates web application: public discovery plus authenticated profile, room, Circle, privacy, and governance surfaces.
- Buildmates deterministic backend: authorization, persistence, candidate scoring, reciprocal state transitions, notifications, and audit records.

## 4. Complete feature system

### 4.1 Landing, identity, and first-run entry

- A public, responsive landing page explains the loop using honest product behavior.
- Primary action is Sign in with ChatGPT.
- A visitor can understand what is read, what is stored, and what is never stored before signing in.
- Codex is the canonical onboarding surface. After installation, the Buildmates plugin immediately resumes the ordered first-run contract, uses conversation-visible connected apps where permitted, and guides the user through one concrete next step at a time.
- The website is the authenticated companion for identity linking, shared setup progress, profile preview and publishing, discovery, chats, rooms, and settings. It also exposes the same state machine as an explicit manual fallback; it does not compete with Codex as a second default setup flow.
- Signed-in website users see their shared setup status and continue in Codex, enter the manual fallback, or arrive at their Buildmates home when setup is complete.
- Profiles, discovery, privacy settings, rooms, and Circles are available through a normal public URL on desktop and mobile browsers. Plugin installation, connected-app setup, and Codex automation run only on Codex surfaces that currently support those capabilities.
- A Buildmates-created cohort, “OpenAI Build Week 2026,” supplies a useful community discovery context and is visibly labeled community-created and unaffiliated with OpenAI.

The first plugin run has an explicit completion contract rather than an open-ended chat. "Install Buildmates", "set up Buildmates", and the plugin's default setup prompt route directly into this contract. Codex calls `get_setup_state` before asking a broad product question, states the finish line, and shows progress through: identity link, context collection, profile understanding, privacy review, page preview, networking preferences, acceptance mode, automation setup, and first useful action. The useful action is a candidate, discovery query, follow/watch, or invite—not a fabricated match.

Onboarding is agentic and adaptive. If connected context is rich, Codex drafts quickly and asks only about uncertainty. If context is sparse, Codex asks focused conversational questions and offers concrete inputs: create a basic profile manually, select one repository or project, paste a short description, provide portfolio/GitHub/LinkedIn/project links, or describe what the user wants included. Required completion data is limited to identity/handle, a short builder description, at least one project or active interest, privacy review, Networking Pulse, acceptance mode, and automation choice. Everything else can improve over time.

### 4.2 Connected-app permissions

Buildmates is the only required plugin. Buildmates uses a generic Work Signal contract, so any connected app that Codex can lawfully read can supply an approved summary. Current platform documentation does not guarantee a third-party plugin can enumerate every app installed by a user. Onboarding therefore presents apps Codex can confidently identify in the active conversation, explicitly declared optional dependencies such as Google Calendar, and any source the user names. It never claims this list is exhaustive, and the web flow does not depend on automatic enumeration.

For each visible app, the user chooses:

- Never use: Buildmates workflows do not ask Codex to read it.
- Ask each time: Codex requests approval before using it for a Work Pulse. An unattended automation skips the source and queues a consent request; a prior one-time approval is not recurring permission.
- Allow approved Work Signals: Codex may read permitted content and submit summaries under the user's explicit sharing policy. Submitted signals remain private to the owner or authorized matching surfaces. Sharing the same idea publicly requires a separate profile or project-update preview and explicit publication approval.
- Actions only, where relevant: the app supplies no matching context but may help after mutual interest. Buildmates internally distinguishes free/busy reading, proposing an event, and creating/updating an event; these are product capability classes, not claims about Google Calendar's actual tool or permission names.

Buildmates stores a source-use preference and an app identifier/label. This preference governs what Buildmates skills may submit or request; it does not modify or override the host platform's connector permissions. Buildmates never receives the app's access token or connector credentials. The connected app's own permissions and action-confirmation rules remain in force.

The permission UI includes:

- the app name and icon when exposed;
- the chosen use mode;
- the most recent Work Signal derived from it;
- revoke and delete controls;
- an explanation when an app is not available in the current conversation.

### 4.3 Work Pulse and Work Signals

A Work Pulse can run during onboarding, manually, or through one recurring Codex automation. It summarizes only approved context into a generic structure:

- kind: project, problem, skill, offer, need, goal, topic, event, or availability;
- short summary written for another builder;
- taxonomy version plus validated canonical topic, tool, domain, stage, and collaboration-intent identifiers;
- free-text summary retained for human understanding;
- source label and source app identifier;
- execution mode: hosted connector or local device;
- last successful refresh and current available, stale, or unavailable status;
- observation date and optional expiry;
- confidence;
- audience: suggested connections, mutual connections, or private;
- optional cohort audience constraint;
- matching permission: usable or excluded;
- evidence sensitivity flag;
- owner approval state.

A Work Signal never contains raw credentials, full prompts, complete chat transcripts, full email bodies, private repository contents, or full document contents. “What the prompt is referencing” may become a concise problem statement, but the prompt itself is not submitted.

Codex may propose classifications, aliases, and relationships, but the server validates identifiers against the active taxonomy. The taxonomy contains `topics`, `topic_aliases`, `topic_relationships`, `tools`, `domains`, `stages`, and `collaboration_intents`, each versioned so matching results remain reproducible as vocabulary evolves. Problems and interests map to topics, ambitions map to goals/collaboration intents, and communities map to governed cohort/community identifiers. Profile, project, and Networking Pulse inputs use the same taxonomy/version contract as Work Signals.

Users can edit, approve, reject, expire, or delete each signal. Stale signals are visibly marked and excluded from current-work ranking after expiry unless renewed.

Revoking a source or deleting a signal immediately invalidates unopened proposals, cached candidate evidence, side-specific explanations, pending notifications, and unevaluated automation work derived from it. Existing rooms retain only information already mutually revealed; the owner can request redaction from the shared context, while audit records keep identifiers and reason codes rather than the deleted content.

The authenticated home includes a private Work Pulse timeline so the owner can see what changed between refreshes. It is an audit and review surface, not a public activity feed.

Hosted connector sources may refresh in a remote scheduled task when the host supports them. Local repositories, local sessions, and other device-bound sources are best-effort: the computer must be on and the Codex desktop app available. Onboarding and the privacy center show this boundary, the last successful refresh, and a manual-refresh fallback instead of silently presenting stale work as current.

The user also maintains an expiring Networking Pulse containing current intention, similar-versus-adjacent preference, local-versus-global preference, introduction budget, quiet hours, matching snooze, serendipity level, and exclusions for people, companies, industries, or project categories. Temporary intentions expire or require reconfirmation. Retrieval applies cluster-diversity and repetition limits so the same narrow community does not dominate recommendations.

### 4.4 Profile understanding and review

Codex proposes a structured profile from approved Work Signals and direct user answers. Before publication, the user reviews:

- name, handle, photo, location, timezone, and working hours;
- headline and short narrative;
- current and previous projects;
- problems currently being solved;
- skills and tools;
- what the user can offer;
- what the user wants help with;
- preferred collaboration styles;
- explicit networking intentions: casual builder conversation, friendship/community, collaborator, cofounder exploration, product feedback, beta exchange, hiring, joining a startup, local coffee, mentorship, or open-ended networking;
- cohorts and communities;
- social links;
- per-field privacy.

Profile drafts are private. Approving and publishing a generated profile makes its canonical page public, shareable, and search-engine indexable. Individual fields may still use Public, signed-in members, suggested connections, mutual connections, or Private, and `allow_matching` remains a separate switch. The conversational shortcuts map to those field-level controls:

- Show on profile.
- Use privately for matching.
- Keep only in Codex, which means it is not submitted to Buildmates.

The review screen clearly separates generated suggestions from user-confirmed facts.

### 4.5 Generative profiles

Codex generates a responsive profile site that reflects the person instead of placing everyone in one template. For new profiles, SurfaceSpec v3 is a secure deployment envelope around Codex-authored semantic HTML and responsive CSS. It is not a component tree or a website-builder template. Codex controls the information architecture, theme, typography, section order, composition, CSS-only motion, and approved media. The v3 envelope contains:

- surface type and owner;
- structured content bindings;
- a complete semantic HTML body fragment;
- a complete responsive stylesheet;
- asset references;
- accessibility metadata;
- responsive behavior;
- Design Policy version;
- base revision and revision metadata.

The generated document contains binding identifiers, not durable copies of private profile values. The server resolves only the fields the current viewer may access, so later privacy changes immediately affect the rendered page. The entire generated profile renders inside an isolated, scriptless iframe. JavaScript, forms, embedded documents, event handlers, imports, active third-party content, and arbitrary network requests are rejected. Images resolve only from exact owner-approved R2 asset paths. Follow, connect, report, privacy, navigation, authentication, and every data-writing control remain trusted Buildmates UI outside the generated document. Existing v2 profiles remain readable until their owners publish a v3 replacement; Buildmates does not automatically convert visual designs.

Canonical profile URLs use `/@handle`, implemented through a verified rewrite to the non-special internal route `/builders/{handle}`. The owner can ask Codex conversationally to revise the profile, preview it privately, publish it, inspect history, and roll back. No deployment is required for a revision.

Profiles can optionally display owner-approved network and building statistics such as mutual connections, public projects, introductions completed, Circles joined, public shipping activity, or custom tracker values. The UI labels every metric as system-derived, connector-derived, or self-reported. It prioritizes proof of work over prestige, excludes followers and popularity ranks, permits hiding counts, and never uses displayed statistics for matching. Token usage is private by default, never affects matching or ranking, and appears only if Codex exposes a reliable usage signal and the user explicitly chooses to publish it.

### 4.6 Projects as first-class objects

Projects are independently owned product objects rather than profile-only cards. A project includes title, slug, summary, status, stage, topics, tools, links, approved media, collaborators, update history, visibility audience, matching permission, and owner. Owners can create, edit, publish, archive, restore, delete, transfer, and reorder projects. Collaborators accept invitations and receive explicit edit permissions. Project visibility and matching permission are evaluated independently, and deleting a project invalidates derived pending match evidence without erasing historical context already mutually revealed.

Project routes use canonical `/projects/{slug}` URLs. Public projects can be followed, shared, indexed, and included in opted-in network statistics; private or restricted projects are omitted from page metadata, social previews, discovery indexes, and graph responses.

### 4.7 Discovery, city map, and build graph

- Buildmates does not expose a people, profile, project, location, or Work Signal search endpoint or directory. Public profiles and projects are reached only through deliberate direct/share links.
- View a MapLibre map with one anonymous aggregate bubble per supported city. A deliberately supplied city participates by default unless hidden, and the first participating builder may create a bubble. Bubble size represents aggregate builder count; project and Connection counts may appear without exposing a person.
- View an anonymous Build Graph whose bubbles group canonical topics extracted from user-reviewed profiles, active projects, and approved current Work Signals. Only canonical topic IDs and aggregate counts enter the graph; raw profile/project/signal text and builder identity never do. Bubble size represents contributing builders, not popularity.
- Start with broad topic bubbles, drill into canonical child topics, and draw weighted links when the same anonymous contribution spans multiple topics. Link strength represents aggregate builder overlap and never exposes a person-to-person edge.
- See honest aggregate network counters computed from production data, such as opted-in builders, public projects, Connections formed, and meetings scheduled; counters are omitted until real data exists and never use fabricated launch numbers.
- Receive private, server-bounded match recommendations with direct, evidence-based explanations after authentication and matching authorization.

The map and graph are functional aggregate network views, not decorative background effects. They provide accessible aggregate-list alternatives and keyboard-operable navigation. Neither surface links to or lists the people, profiles, projects, or Work Signals represented by an aggregate bubble.

The public build graph never exposes project titles, profile fields, Work Signal summaries, rooms, Connections, collaboration, Circles, or person-to-person edges. A signed-in personalized explanation may use viewer-authorized evidence outside the public graph.

### 4.8 Cold-start and network growth

A user receives value even when no strong match exists. Buildmates supports:

- shareable generated profile and project links;
- personal invite links;
- “Invite a builder whose work you follow”;
- shareable connection cards such as “I’m building X—find people working nearby”;
- following public projects and topics;
- “Notify me when someone relevant joins” watches;
- honest no-match states that preserve the user's preferences and continue watching;
- immediate exploration of aggregate city and topic activity through the map and build graph.

Invite links never pre-authorize profile visibility, matching, or a connection.

Invites use expiry, revocation, per-sender and per-cohort quotas, repeated-recipient suppression, recipient blocks, abuse reporting, and rate limits. Invite and share-card payloads contain only data already authorized for the recipient or public audience and never include private matching evidence.

Every public profile and public project is search-engine indexable by default; there is no separate indexing control. Canonical URLs, robots directives, structured metadata, and social previews are generated only from public fields. Drafts and restricted projects remain non-indexable and use neutral unfurls. Owners can revoke a share card or invite without changing the canonical profile/project URL.

Cohorts are deferred from the current product and navigation. Existing cohort domain tables and authorization code remain dormant for a possible later community release; no day-one flow depends on cohort creation, discovery, invitations, filtering, or audience expansion. Circles remain the active member-created group model.

### 4.9 Deterministic candidate retrieval

D1 computes a bounded shortlist using structured Work Signals. The score may combine:

- topic/problem overlap;
- shared or adjacent work, interests, ambitions, location, community, and company-building stage;
- optional complementary offer-to-need fit in either or both directions;
- tool or domain adjacency;
- stated collaboration-style fit;
- timezone and availability compatibility;
- cohort proximity;
- currentness and confidence;
- negative constraints, blocks, prior declines, and repetition penalties;
- diversity/serendipity allowance within a relevance floor.

The algorithm returns a candidate and score components; it does not decide that a relationship should open. Sensitive traits are excluded. Exact weights are versioned and testable. A shortlist is capped to conserve user automation context.

A denormalized `builder_match_index` stores a monotonically increasing index version plus each builder's current canonical topics, tools, domains, stages, intentions, location/timezone bucket, cohort IDs, preference flags, freshness, and exclusion keys. Material Work Signal, profile, project, cohort, or Networking Pulse changes or expiries rebuild that builder's row and invalidate every pair-score row involving the builder. Pair-score records store both builder-index versions, component evidence IDs and audience decisions, taxonomy/weight versions, and deterministic totals. Retrieval refuses stale versions and reapplies expiry, visibility, pause, and block checks at query time. Each automation receives only the viewer-authorized parts of the top 20–30 eligible candidates; private contributing evidence is omitted or replaced with a non-revealing reason code. The user's Codex evaluates and selects the strongest matches from that batch. GPT-5.6 Sol High is used during implementation and offline evaluation to design, challenge, and calibrate the algorithm; the production backend itself performs no matching inference.

Embeddings are intentionally excluded from day one. They may be added only after deterministic retrieval is measured against a labeled evaluation set and misses relevant connections that structured signals cannot recover.

### 4.10 Independent Codex evaluation and reciprocal matching

The user-side automation retrieves a small shortlist plus safe summaries. Codex assesses:

- why the other person could be genuinely interesting or relevant to the user now;
- which current work, interests, ambitions, location, community, or stage create mutual relevance;
- optional offers, needs, or collaboration opportunities when they are actually present;
- potential conflicts or irrelevance;
- whether to approve, decline, or defer;
- a concise, non-sensitive explanation safe to share.

The evaluation is stored as an agent decision for that user. Buildmates never treats A's Codex decision as B's decision.

Acceptance modes are selected in onboarding and adjustable later:

| Person A | Person B | Room-opening condition |
|---|---|---|
| Manual | Manual | Both Codex evaluations approve and both people tap Interested. |
| Full Autopilot | Manual | Both Codex evaluations approve and B taps Interested. |
| Manual | Full Autopilot | Both Codex evaluations approve and A taps Interested. |
| Full Autopilot | Full Autopilot | Both Codex evaluations independently approve. |

If the other person's automation has not evaluated the proposal, the match remains pending. Declines do not reveal private reasoning. A user can undo an Interested state before the room opens and can change acceptance mode for future proposals.

Disabling Full Autopilot or pausing matching immediately removes automatic acceptance from every unopened proposal for that user. Any pending proposal then requires a human Interested tap unless the user explicitly re-enables autopilot. Manual and Full Autopilot are both first-class onboarding choices. Full Autopilot never removes the requirement for two independent Codex approvals; it removes only that user's human tap.

Full Autopilot is enabled only after a per-user capability check proves the scheduled task can make the required Buildmates write under current workspace policy. If host approval is required or the automation is unavailable, the side enters `approval_required` or `automation_unavailable`; Codex prepares the evaluation, but no automatic acceptance is recorded and the room cannot open until the user confirms.

### 4.11 Match explanations and notification states

Each candidate has a side-specific short explanation grounded in evidence IDs the viewer is authorized to see, such as: “You are both improving retrieval evaluation. Maya is testing hybrid search; you are building failure analysis. You each asked for feedback on measurement.” A genuinely shared explanation is created only after both sides authorize the underlying claims.

States are explicit:

- shortlisted;
- awaiting your Codex evaluation;
- awaiting your tap;
- awaiting the other person's automation;
- awaiting the other person's tap;
- deferred until a recorded revisit date or signal change;
- approval required or automation unavailable;
- mutually approved;
- declined;
- expired;
- room opened.

Notifications describe the actual pending action and never imply the other person accepted before they did.

### 4.12 Lightweight themed rooms

A mutually approved match creates a private route at `/rooms/{id}`. The initial room contains:

- the connection reason and shared context safe for both members;
- a suggested first message or question;
- a lightweight native chat;
- member identities and availability;
- optional link-out actions;
- scheduling assistance when permitted;
- report, block, leave, and privacy controls.

The room is visually themed to the connection context. A retrieval-augmented-generation connection can use language, structure, and art direction that feels specific to retrieval work, but it does not immediately show an experiment tracker, metric dashboard, or leaderboard.

Messages are private to room members. Buildmates does not use raw room content for matching. Members may explicitly submit structured post-conversation feedback.

### 4.13 Persistent one-to-one connections

When a room opens, Buildmates also creates a persistent mutual Connection independent of the room's upgrade state. A Connection stores:

- when and why the people met;
- the approved shared context that connected them;
- side-specific active, muted, or ended state plus a derived pair state;
- each person's private notes, visible only to that person;
- optional reconnect reminders;
- authorized public project and profile updates from the other person;
- renewed-relevance notifications when their current work overlaps again;
- associated rooms, meetings, and Circles.

Muting is personal: it suppresses that person's relationship notifications without changing the other person's experience. If either person ends the Connection, the derived pair state becomes ended, future connection-only disclosure and new room messages stop for both people, and each person retains an exportable historical copy of content they were already authorized to see. The other person sees that the Connection ended but not a private reason. Reconnecting requires a new mutual handshake; one person's request cannot restore access alone. Blocking remains the stronger safety action. Most useful relationships are expected to remain simple Connections rather than becoming Circles or upgraded workspaces.

### 4.14 Intro memory and room progression

After a meaningful conversation or an inactivity threshold, the user's automation asks how the introduction went. Feedback captures only structured, user-approved memory such as:

- useful or not useful;
- reasons such as expertise fit, responsiveness, collaboration style, timing, or shared problem;
- whether the user wants similar introductions;
- whether follow-up is desired;
- optional private note that remains outside public profiles;
- whether the room should remain a chat or become a workspace.

The progression is:

1. Match context: the reason and boundaries are prepared.
2. Lightweight room: themed chat and scheduling.
3. Feedback: Codex asks about conversation quality.
4. Upgrade proposal: after positive signals, Codex explains specific useful modules.
5. Upgraded workspace: selected modules are added only after consent and governance approval.

Possible upgrade modules include a shared experiment tracker, resource shelf, decision log, demo checklist, feedback queue, evaluation matrix, milestone tracker, shipping scoreboard, or custom module generated from approved primitives.

### 4.15 Room design governance

- Either member may ask Codex to create a shared redesign proposal.
- The proposal starts as a private preview for its creator.
- Publishing a shared redesign requires both current members to approve.
- Either member may maintain a private personal view that does not affect the shared room.
- Every shared revision has history, author, approvals, Design Policy version, and rollback.
- A base-version check prevents two Codex runs from overwriting each other. A stale proposal must be rebased or regenerated.
- Publishing rechecks current membership and the current governance version. Leaving, blocking, or a role change invalidates collected approvals that no longer satisfy the active rule.
- Content and membership permissions cannot be changed through CSS or surface-generation instructions.
- Upgrade modules that create shared behavioral state require explicit consent separate from visual redesign approval.

### 4.16 Scheduling and calendar handoff

Calendar is an optional connected app, not a dependency. If the user permits calendar actions, Codex may:

- inspect that user's free/busy windows only when the installed Calendar app exposes a compatible read capability and its existing rules permit the action;
- submit only user-approved candidate windows to the room, never raw calendar event details;
- intersect both members' submitted windows server-side or use an asynchronous propose/accept/counter flow when only one side shares availability;
- create or update an event only under the connected app's confirmation rules;
- prepare meeting context from approved match information.
- generate an optional agenda from mutually visible match context.

Event creation returns a non-secret action receipt to the room containing provider label, organizer, time, status, and external event identifier when the connector exposes one. Buildmates stores proposed windows, selections, and receipts but no calendar credentials, event bodies, or unrelated availability. When no calendar app is available, Buildmates provides timezone-aware suggestions and an ICS download.

The executable handoff is optional and host-mediated. The Schedule action offers: continue in Codex through a verified `codex://` deep link, copy a ready scheduling prompt when deep linking is unavailable, propose/accept/counter times entirely inside Buildmates, or download ICS. In the Codex path, `prepare_calendar_handoff(room_id)` returns authorized participants, timezones, candidate windows, and agenda; Codex invokes the user's Google Calendar app; the user confirms the write under that app's policy; then Codex calls `attach_calendar_event` with the minimal receipt. The Buildmates Site and MCP server never invoke Google Calendar directly.

Google Calendar tool names and actions are capability-gated against the installed plugin before native scheduling is advertised. If compatible free/busy or event-creation tools are unavailable, the product uses approved proposed windows plus ICS and does not claim a native Calendar write.

### 4.17 Build Circles and triadic closure

Buildmates watches accepted relationship structure. When three or more people have reciprocal relevance—such as A connected to B and C, while B and C also have a plausible mutual fit—the system may propose a Circle. A proposal moves through proposed, invited, accepted/declined, and active states. Before every invitee accepts, each person sees only a privacy-safe proposed purpose and their own invitation; Buildmates does not reveal the other members, their existing connections, or inferred relationship graph.

A Circle begins with:

- a clear shared purpose;
- member list and relationship context;
- private group chat;
- lightweight shared surface;
- invitation and leave controls.

It does not begin with a crowded operating system. As the group becomes active, Codex may propose modules such as a shipping room, tracker, resource library, event board, feedback rotation, or custom leaderboard.

For a user-created Circle, the creator is the initial owner and admin. For a Buildmates-suggested Circle, the first invitee to accept creation becomes provisional owner, and the Circle activates only after all required members accept. Server-stored roles support member, admin, and owner semantics. The owner/admin can promote another member, transfer ownership, revoke admin, remove a member, and configure whether publishing uses admin approval or a member vote. Owner-only actions are ownership transfer and Circle deletion; the final owner cannot leave or be removed until ownership is transferred or the Circle is deleted.

Governance rules:

- any member may create a private view;
- any member may propose a shared Circle design;
- admins publish proposals by default;
- a Circle can enable member voting with a defined quorum;
- tracker and leaderboard rule changes require explicit approval because they change group behavior;
- rankings are local, opt-in, and tied to member-defined goals rather than global popularity.

### 4.18 Generative Circle modules and local leaderboards

When a Circle upgrades, Codex can assemble approved modules and define member-visible rules. Examples include:

- demos shipped this sprint;
- experiments completed;
- feedback given;
- blockers cleared;
- interview practice sessions;
- documentation improvements;
- demo readiness.

Every metric states what counts, who can record it, whether evidence is required, the reset period, and how disputes are handled. A member can opt out of being ranked. Historical results remain auditable when rules change.

### 4.19 Notifications and the one-automation model

Each user configures one Buildmates automation rather than one task per feature. Cadence options include Automatic (a daily check that no-ops and does not notify when nothing relevant changed), daily, a few times per week, weekly, and manual-only. A run can:

- refresh approved Work Signals;
- refresh or reconfirm the Networking Pulse;
- expire stale signals;
- fetch a small shortlist;
- evaluate new candidates and inbound proposals;
- notify the user of required taps;
- report newly opened rooms;
- ask for intro feedback;
- propose room or Circle upgrades;
- notify the user when a watched topic gains a relevant builder or an existing Connection becomes relevant again;
- prepare permitted calendar actions.

The automation uses the user's Codex plan and counts against applicable limits. The default recommendation is Luna High for routine runs and Luna Extra High for initial profile or complex generative-surface work, reflecting the requested product strategy. Buildmates can recommend a model but cannot force the host selection.

Buildmates posts outcomes to the Codex/ChatGPT task inbox. ChatGPT may deliver the notification channels enabled and supported for that account and surface. Buildmates does not promise a specific push or email channel and introduces an external notification adapter only when evidence shows host notifications are insufficient.

Buildmates separates immediate product events from scheduled intelligence. Invitations, match acceptance, new messages, Calendar proposals, Circle invitations, reconnect requests, moderation outcomes, and security events enter the in-app inbox immediately and appear through authenticated site polling. Codex automations handle Work Pulse refreshes, candidate evaluation, renewed relevance, feedback, upgrades, and digest summaries. When host push delivery is unavailable, the Site remains the truthful immediate source and the product does not promise off-site delivery.

### 4.20 Privacy, safety, and user control

- A “What Buildmates knows about me” page lists all server-held profile fields, Work Signals, permissions, evaluations safe for the owner, rooms, Circles, and automation state.
- Users can change visibility, revoke a source, disconnect all Codex syncing, delete a signal or project, pause matching, disable Full Autopilot, block another user, leave a room, report abuse, export data, or delete the account.
- Published profile pages are public and indexable. Profile fields and projects use the canonical audience enum: public, signed-in members, suggested connections, mutual connections, or private. Work Signals are restricted to suggested connections, mutual connections, or private and can never enter public search, graph data, metadata, or public pages. `allow_matching` remains independent and defaults on until the user pauses it.
- Location, when deliberately supplied or approved, is coarse city/region or timezone only. Codex may include an approved city naturally in the public profile composition; it is not governed by a separate city-display permission.
- Anonymous Map and Build Graph contributions are on by default for approved coarse cities and canonical public/profile topics, with an unobtrusive opt-out in privacy settings. The map exposes city-center coordinates and aggregate counts only, never individual coordinates, precise or live location, or a city roster. Work Signals never contribute to public aggregates.
- Sensitive traits are not inferred for matching.
- Private match reasoning is not shown to the candidate.
- Blocks apply before candidate retrieval and prevent new shared spaces.
- Blocking archives an existing two-person room, stops new messages and invitations, and removes it from the blocked person's active navigation. Each party retains access to their own export and report evidence; neither party gains new access to the other's data. Unblocking does not automatically reopen the room.
- When blocked users share a Circle or cohort, direct messages, mentions, invitations, profile disclosure, private modules, and relationship edges between them are disabled. Existing group membership does not reveal the block. The blocker can remain with limited coexistence or leave; a report, not a private block alone, opens an admin/operator case. Group-wide content remains governed by group membership until moderation removes it.
- Account deletion immediately revokes sessions and connector identity links, removes or anonymizes profile, project, generated-surface, relationship, scheduling, and authored free-text data, and physically deletes owned assets. Opaque relational identifiers, timestamps, moderation decisions, reason codes, and content-free audit markers may remain where needed for safety, fraud prevention, and database integrity; report details and appeal statements are redacted. An idempotent administrator recovery job completes physical asset deletion after a transient storage failure.
- Moderation controls are real server actions, not decorative links.

Reports create cases in an operator moderation queue with reporter-visible received, reviewing, actioned, or closed status. Operator roles can hide or remove profiles, projects, generated surfaces, messages, media, invites, and group content; restrict matching or messaging; suspend accounts; preserve necessary evidence; record reasons; and process an appeal/review request. Impersonation and urgent safety reports receive dedicated reason codes. Operators cannot browse unrelated private Work Signals or notes.

Source revocation removes the source from future matching immediately. For already shared context, the owner may request redaction of their contributed field from shared room summaries and generated surfaces. Redaction regenerates affected surfaces, removes the value from future responses and exports, leaves the other person's independently retained messages/notes untouched, and keeps only a content-free audit marker. It never claims to erase copies another person already lawfully exported.

### 4.21 Feedback and learning

Buildmates learns from structured outcomes rather than reading private chats. Signals include match approval/decline, response timing, user-rated usefulness, stated reason, follow-up intent, blocks, and room upgrade acceptance. Matching-weight changes are versioned and evaluated against fixtures before release.

### 4.22 Product validation experience

The repository includes clearly labeled fixtures for multiple fictional builders. The reproducible validation flow proves:

1. A user signs in and permissions connected apps individually.
2. Codex submits approved Work Signals.
3. Codex generates and revises a distinctive profile.
4. Deterministic retrieval produces an explainable shortlist.
5. Two independent evaluations and configured acceptance modes produce a reciprocal match.
6. A themed lightweight room opens and messages persist.
7. Feedback leads to a specific optional upgrade proposal.
8. A Circle proposal proves the relationship-expansion path.

A clearly labeled test harness can simulate the second user's independent evaluation and response so the complete reciprocal flow is reproducible without weakening the real multi-user path. Real users can connect their own Codex context and create genuine profiles.

## 5. Runtime architecture

### 5.1 Separate web and MCP deployment units

Buildmates is one monorepo with independently deployable units:

- `apps/web` — ChatGPT Sites web application, authenticated/public APIs, in-app inbox, dynamic surface renderer, and Sites-managed D1/R2 access;
- `apps/mcp` — Streamable HTTP MCP server and OAuth flow;
- `packages/domain` — entities, policies, state machines, authorization contracts, and shared validation;
- `packages/database` — schema, migrations, repository interfaces, D1 adapters, and service client;
- `packages/surfaces` — SurfaceSpec schema, trusted components, sanitization, and Design Policy;
- `packages/matching` — taxonomy, denormalized index, deterministic scoring, fixtures, and evaluation contracts.
- `packages/mcp-core` — one transport-independent MCP protocol/tool registry mounted by thin Sites or external adapters.

The web and MCP units may share one ChatGPT Sites deployment only if launch validation proves streaming, OAuth, reconnect, and timeout behavior. Otherwise MCP deploys to a Cloudflare Worker or Vercel without changing its public tool contract. If Sites itself cannot satisfy public reachability, stable authenticated sessions, required storage, or the secure internal boundary, the prepared web adapter deploys the same application contracts through Cloudflare first or Vercel rather than shipping a partial Site.

When MCP is external, it does not assume direct access to Sites-managed D1/R2. It calls a narrow internal API owned by `apps/web` using a short-lived signed service assertion bound to the verified MCP OAuth subject, audience, action/scope, expiry, and replay-protected ID. The web unit resolves the active identity link itself and never trusts a submitted internal `userId`. The route is disabled when MCP is co-deployed. If ChatGPT Sites cannot securely expose that service boundary, the architecture gate selects a host-neutral database before feature implementation. Profiles, rooms, and Circles remain database records rendered by shared code; creating one never deploys a new site.

Web identity and MCP identity use separate authentication channels and never join by email or display name. GitHub OAuth establishes the app-owned website session; ChatGPT/Codex establishes a separate MCP OAuth identity. The user requests a short-lived, single-use linking code from the authenticated website, completes Buildmates MCP OAuth in Codex, and submits that code through MCP. Buildmates consumes the code and stores both provider subjects against one stable internal `userId`. Revoking either identity link does not silently delete the other.

`identity_links` stores `id`, `user_id`, `provider_channel` (`web` or `mcp`), `provider_issuer` (`chatgpt_sites`, `github`, or `buildmates_mcp`), `provider_subject`, normalized `workspace_scope`, `linked_at`, and `revoked_at`. The public MCP accepts only the literal `global` scope until a safe multi-workspace authorization handoff exists. A separate `identity_link_codes` record stores only a unique hashed code, requesting user, expiry, attempt count, and consumed time. The database uniquely constrains the normalized channel/issuer/subject/workspace tuple and consumes a link code with compare-and-set semantics. Web authentication headers are never accepted as proof for a remote MCP caller.

GitHub OAuth is the launch website authentication method after anonymous non-owner Site reachability passed but SIWC failed to provide a stable server-verifiable subject. The website verifies GitHub's numeric account ID and creates an app-owned revocable session; it never uses login, email, or display name to merge identities. Buildmates' MCP OAuth 2.1 authorization server remains separate and issues a distinct stable opaque MCP subject with no user-data access until explicit linking.

### 5.2 Portability boundaries

Application code depends on interfaces rather than Cloudflare globals:

- `IdentityProvider`
- `ProfileRepository`
- `WorkSignalRepository`
- `MatchRepository`
- `SurfaceRepository`
- `MessageRepository`
- `AssetRepository`
- `NotificationAdapter`
- `Clock`

ChatGPT Sites/D1/R2 implementations ship first. `apps/mcp` depends on domain contracts and either the D1 repository adapter when co-deployed or the authenticated web service client when separately deployed. A future host migration swaps adapters and migrates data without replacing domain state machines or UI routes.

### 5.3 Core persistence model

The schema includes:

- users and public handles;
- identity links and short-lived single-use identity-link codes;
- connected-app permission records;
- Work Signals and visibility/expiry;
- versioned topics, aliases, relationships, tools, domains, stages, and collaboration intents;
- denormalized builder match index and versioned pair-score records;
- expiring Networking Pulses, introduction budgets, quiet hours, snoozes, exclusions, and watches;
- profiles, projects, and cohorts;
- invite links, cohort invitations, topic/project follows, and shareable connection cards;
- Design Policies and policy versions;
- surfaces, revisions, approvals, personal views, and asset references;
- stable unordered match pairs, versioned proposal attempts, candidate batches, and deterministic score components;
- per-user Codex evaluations and human responses;
- reciprocal match state and audit events;
- rooms, members, messages, feedback, and upgrade proposals;
- persistent Connections, private per-user notes, reminders, update subscriptions, and relationship state;
- Circles, roles, proposals, votes, modules, metrics, and entries;
- notification inbox and automation checkpoints;
- blocks, reports, exports, and deletion jobs.

Authorization checks use membership and ownership tables, never only client-visible state.

### 5.4 Matching state machine

For each unordered user pair, Buildmates stores a stable `match_pair` and one or more immutable, versioned `match_proposal` attempts. A materially new approved evidence version may create a new proposal after cooldown without overwriting a prior decline or expiry. Each proposal stores:

- candidate evidence version;
- A evaluation and B evaluation;
- A human response and B human response;
- A acceptance mode and B acceptance mode captured for the proposal;
- expiry and terminal state;
- side-specific pre-match explanations with evidence IDs and audience checks;
- shared explanation created only after mutual authorization.

An implementation-neutral atomic operation verifies that both authenticated actors evaluated the same current proposal, both evidence/index versions remain valid, the proposal is unexpired, neither side is blocked or paused, and the captured Manual/Full Autopilot plus capability rules still pass. One transaction keyed uniquely by `match_pair_id` creates exactly one persistent Connection, both Connection-side records, one room, both memberships, the terminal proposal transition, notifications, and an audit event. The Sites capability gate must prove the exact D1 primitive used—atomic batch, compare-and-set, or another supported mechanism—under concurrency. Unique constraints and idempotency keys remain the final duplicate-Connection and duplicate-room defense.

### 5.5 Chat transport

Day-one chat uses persisted messages with bounded polling, optimistic send state, idempotent client message IDs, pagination, unread checkpoints, and retry/error UI. Real-time sockets are unnecessary until measured product usage justifies them or a direct Sites test proves they are simple and reliable. The repository interface preserves a later transport upgrade.

### 5.6 MCP contract

The Buildmates MCP app exposes narrow, user-authorized tools rather than a general database interface. The initial contract includes operations equivalent to:

- get the HTTPS identity-link page or code-entry instructions for the current OAuth principal without exposing user data;
- complete the identity link by atomically consuming a short-lived code; this is the sole OAuth-authenticated pre-link mutation;
- get the one-shot setup state and next incomplete step;
- complete an idempotent setup step spanning source-use choices, reviewed signals, profile publication, automation configuration, and first shortlist;
- get onboarding and connected-app permission state;
- save a connected-app preference;
- submit approved Work Signals;
- review and update the user's expiring Networking Pulse;
- review and update the user's profile model;
- create/revoke invite links and manage authorized follows/watches;
- fetch a bounded candidate shortlist or inbound proposal;
- record the user's Codex evaluation;
- record a manual Interested/decline action;
- read opened-room and Circle summaries;
- read and update the user's Connections, private notes, reminders, mute/end state, and renewed-relevance acknowledgements;
- submit structured intro feedback;
- fetch a surface generation brief with current Design Policy;
- submit a surface revision or private view;
- approve, publish, or roll back an authorized revision;
- prepare a viewer-authorized Calendar handoff without exposing unrelated availability or room data;
- attach an idempotent minimal Calendar event receipt after provider confirmation;
- create or update the user's automation checkpoint.

Except for the narrowly scoped `complete_identity_link`, all user-specific reads and mutations require OAuth plus an active identity link. Mutations validate ownership/membership, accept idempotency keys, and return explicit confirmation state. `prepare_calendar_handoff` is an authorized read; `attach_calendar_event` is a consequential idempotent write that stores only event ID, provider label, start/end, participants, and status. Tool metadata declares read-only, open-world, destructive, and consequential-write behavior accurately; recording an evaluation is consequential because it may open a room. Tools do not receive third-party credentials.

## 6. Runtime Design Policy

The canonical product-specific generation policy is kept in source control and deployed into D1 as an immutable version. Codex must call the generation-brief tool before generating a profile, room, or Circle revision. The brief combines:

- the active Design Policy version;
- surface type and allowed modules;
- authorized content bindings;
- member and publishing governance;
- current base revision;
- responsive and accessibility constraints;
- banned implementation patterns;
- privacy boundaries;
- surface-specific goals and context.

The Design Policy requires a coherent, product-specific visual world and forbids interchangeable AI-SaaS styling, fake social proof, decorative controls, unreadable contrast, animation-gated content, arbitrary global CSS, external tracking, remote script injection, and UI text that leaks internal planning language. It requires real content, keyboard operation, reduced-motion support, durable empty/error/loading states, and a memorable signature element where appropriate.

Every revision stores `design_policy_version`. D1 is the runtime distribution layer, not the sole source of truth. Policy updates are explicit migrations and old shared surfaces are never silently replaced.

## 7. Security and abuse boundaries

- Authenticate every web and MCP request. The only unlinked OAuth principal operations are `get_link_url` and atomic `complete_identity_link`; all other user-specific operations map to one stable Buildmates user.
- For external MCP, verify signed audience/scope/expiry/replay claims and resolve the MCP subject to the active link server-side; never accept a submitted internal user ID as authority.
- Enforce object-level authorization for profiles, rooms, messages, surface revisions, Circle roles, votes, and exports.
- Sanitize and scope generated markup/CSS; reject scripts, event handlers, dangerous URLs, external forms, and data exfiltration techniques.
- Apply content-security policy and strict asset allowlists.
- Validate all tool inputs with shared schemas.
- Rate-limit MCP writes, message sends, reports, candidate refreshes, and generation submissions.
- Use idempotency keys for automation mutations.
- Record security-relevant audit events without storing secret content.
- Prevent blocked users from appearing in retrieval, accessing rooms, or inviting each other.
- Provide safe failures when connector context is unavailable or insufficient.

## 8. Accessibility and responsive requirements

- All primary flows work with keyboard and screen reader labels.
- Focus is visible and returns predictably after dialogs.
- Touch targets meet mobile sizing expectations.
- Color is not the only carrier of match, privacy, role, or status information.
- Generated themes must meet text and control contrast thresholds.
- The globe and graph have equivalent searchable list views.
- Motion respects `prefers-reduced-motion`; content remains present without animation.
- Chat supports long text, code, URLs, and narrow screens without horizontal page overflow.
- Profile and room preview modes clearly distinguish private drafts from published shared state.

## 9. Explicit exclusions from day one

- No Buildmates-funded model inference.
- No vector database or embeddings unless the deterministic evaluation gate later justifies them.
- No arbitrary generated JavaScript.
- No automatic ingestion of all installed apps.
- No raw prompt, chat transcript, email-body, document, or repository mirroring.
- No global popularity leaderboard.
- No immediate module-heavy room after a match.
- No in-product video calls.
- No external transactional email system unless the notification gate fails.
- No enterprise organization administration.
- No claim that the plugin can force a Codex model or reasoning level.

These are architectural exclusions, not abandoned product ambition. The design preserves clean extension points.

## 10. Success measures

Before release, quality is measured through a reproducible product funnel rather than fabricated adoption:

- onboarding completion without ambiguous permissions;
- percentage of extracted signals explicitly approved;
- deterministic retrieval precision on a labeled fixture set;
- reciprocal state-machine correctness across all acceptance-mode combinations;
- time from mutual approval to a usable room;
- successful chat and scheduling handoff;
- feedback completion and upgrade-proposal relevance;
- accessibility and mobile test pass rate;
- zero unauthorized cross-user reads in the test matrix.

Post-launch product metrics may include match acceptance, useful-conversation rating, repeat interaction, Circle formation, and opt-in upgrade conversion. They are not presented as existing results until real users produce them.

## 11. Open operational choices that do not block implementation

- Exact visual identity will be explored during the UI phase under the canonical anti-slop design law and verified with rendered desktop and phone states.
- The first deterministic matching weights will be fixed from labeled fixtures and can change without altering the reciprocal state machine.
- The default automation cadence will be recommended during onboarding and remains user-controlled.
- The repository begins private and can become public with an MIT license after the production release boundary is verified.

These choices have bounded interfaces and do not change the approved product behavior above.
