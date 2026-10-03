# Buildmates after the hackathon

Historical read-only baseline, captured before the implementation on October 2. Current candidate behavior and release gates are recorded in [the chat-native program](chat-native/INDEX.md).

Assessment date: October 2, 2026. Scope: product direction and the work required for a public plugin release. Recommendations are proposed changes, not implemented behavior or an accepted replacement for the existing specification.

Confirmed user direction, October 2: Buildmates should be an agentic application installed as a proper plugin, with signup and ongoing use through ChatGPT web or Codex. Both are acceptable product homes. This supersedes the earlier Codex-only initial-host recommendation. The specific implementation changes below remain proposed.

Buildmates is worth continuing. Its strongest idea is that the work someone is doing can help them meet people they would actually enjoy knowing. Approved work context, mutual introductions, and a space that grows with a relationship belong together. The next release should make that experience easy to reach and trustworthy enough to use repeatedly.

The repository already contains substantial engineering. Adding more features before resolving installation, first-use friction, network density, and release proof would make the product harder to assess.

## What is verified now

| Evidence | October 2 finding | Boundary |
| --- | --- | --- |
| Source | Local `main` at `3ba3b9850e2c4f8d0bfbe046ea3756606f598e56`; 184 commits, all in July 2026 | Existing uncommitted video and temporary files were preserved. No product code was edited. |
| Hosting | Sites reports public Buildmates version 103, last updated July 21 | Site metadata does not establish the exact deployed Git revision. |
| Public runtime | Six existing smoke checks passed: landing, D1 readiness, headers, protected-route redirect, robots/manifest, unauthenticated MCP boundary | The MCP check returned 401. It proves authentication enforcement, not an authenticated tool call. |
| Local tests | 50 of 52 focused tests passed across setup, matching, MCP contracts, generated-page security, and authorization | Both rich/sparse onboarding completion tests failed. The full release suite was not run. |
| Public browser | Landing, install, and Map inspected in the in-app browser | Desktop read-only inspection; no new phone, authenticated, or two-person QA. |
| Public activity | Map displays 258 builders, 253 active projects, and 97 connections | Documented hackathon fixtures contribute to these totals; no visible demo disclosure appeared on the inspected Map. They are not organic adoption counts. |
| Identity inventory | Bounded live table read found one active MCP principal and one active web principal, alongside revoked records | Principal rows are not installation, retention, or human-usage counts. This pass did not identify or audit an external-user cohort. |
| Directory discovery | Available plugin search returned no Buildmates result | Search is not exhaustive and does not reveal the developer dashboard's private submission status. |

Older adoption notes guided the metric checks. Their July/August counts were not reused as current traction.

## Preserve the product's identity

Keep friendship, community, cofounder discovery, and peer relationships within the product. Narrow the first audience to active Codex builders so there is a practical place to establish density; do not turn every introduction into an offer/need transaction.

Keep approved structured summaries, deterministic retrieval, independent consent on both sides, and persistent Connections. Keep generated profiles and spaces, including preview, shared approval, history, and rollback. Those are meaningful parts of Buildmates, not decoration.

Keep the privacy boundary: source research happens in the user's environment; Buildmates receives the approved projection. Avoid popularity rankings, token-consumption rankings, public people search, or private-message mining. The strongest future advantage would be a network of active people and demonstrated introduction quality. A generated profile alone does not establish that advantage.

## Make the first experience smaller

Current setup requires ten ordered steps, including custom profile publication and automation configuration. The recommended workspace path requires reviewing every task in the approved project inventory. That is a costly commitment before a user has experienced a useful introduction.

Proposed first experience:

1. Connect Buildmates and explain the source/publication boundary briefly.
2. Let the user select one project, paste a description, or choose a larger workspace review. Start with one selected project by default.
3. Show the exact profile summary and matching fields for review, plus who they would like to meet. Begin with Manual acceptance.
4. Save a matching-private profile and show a few genuinely eligible introductions, or an honest no-match result. Offer a shareable profile as a separate choice.

Offer custom profile design and Work Pulse after that initial result, or earlier when requested. Preserve the richer workspace review as an explicit option. A user should not need an indexed public page or a recurring automation to participate in private matching.

This changes the existing onboarding specification. Implement it as a versioned capability model: account connected, reviewed matching profile, optional public profile, and optional recurring refresh. Preserve completed legacy accounts and drafts. The server must still enforce consent and eligibility; shortening the experience must not simply skip required evidence writes.

Authentication, source approval, exact first sharing, public publication, recurring schedules, and interpersonal consent remain distinct boundaries. Clear defaults and bounded reviews can reduce friction without removing them.

## Give the product value when the network is sparse

A reviewed builder profile and approved project updates provide something useful to share immediately. Generate the more expressive custom page when the user chooses that benefit. Someone can then invite a person they already know, and both can use a room after reciprocal consent.

Use existing invite links, profile sharing, follows, and Circles to build a small, related community. Start with one active builder community rather than scattering recruitment across every city. No outreach was performed in this assessment.

For discovery, show up to a few strong suggestions with a specific, viewer-authorized reason: shared subject, adjacent work, stage, curiosity, or location. Include freshness and let the user dismiss or adjust intent. Do not fill a quota with weak suggestions. No match should remain an acceptable outcome.

Audit pending-proposal delivery and returning-user discovery as carefully as candidate ranking. Both sides need current approved context and a working way to notice and respond to an introduction. A successful scoring function cannot compensate for a proposal the other person never sees.

## Improve the ongoing plugin experience

Design the recurring experience around tasks users naturally ask for: update my current work, find someone relevant, review incoming interest, remember why we connected, or change this room. Route to the relevant capability without re-running onboarding or requiring product vocabulary.

Work Pulse should inspect only approved sources that need refresh, submit changed summaries, and evaluate one bounded candidate batch. Allow a user-controlled cadence, persist real run outcomes, suppress duplicate suggestions, and stay quiet when nothing changed. Permission loss or unavailable automation must produce a visible, accurate state. Never claim a host schedule exists from a saved preference alone.

Retain Full Autopilot as an explicit advanced choice with independent approvals, capability checks, limits, pause, and revocation. Manual should be the proposed initial default until the user understands actual introduction behavior.

Keep custom rooms and Circles as a relationship benefit. Add a useful board or tracker when members want one. Preserve lightweight chat as a complete experience. Native chat, membership, safety, and actions remain outside generated HTML/CSS authority.

## Concrete plugin-release gaps

The public package at `plugin/` uses `apps` and `.app.json`. Current OpenAI submission guidance rejects packages containing app references and requires declaring the MCP connection directly. The beta package at `plugins/buildmates/` already uses that connection shape. Both manifests have a 34-character subtitle, above the current 30-character submission limit, and omit support and icon fields. The guidance also provides an explicit onboarding-skill field. [Current submission reference](https://developers.openai.com/plugins/deploy/submission).

Use one canonical plugin source and produce beta/public variants from it. Keep exactly one Buildmates MCP registration. Include the existing support page, real brand assets, the chosen onboarding entry, and reviewer cases. Validate the actual release ZIP, not just source JSON. Dashboard review and publication status remain unverified.

Treat OAuth compatibility as a release contract. Verify discovery, PKCE, redirect handling, token refresh/revocation, fresh-session activation, and consent behavior against the supported host. Current OpenAI guidance supports DCR and describes CIMD as the preferred option where supported; evaluate it without weakening redirect validation. [Authentication reference](https://developers.openai.com/plugins/build/auth).

Build for ChatGPT web and Codex against one backend and plugin identity. Current documentation describes a universal plugin directory shared by both. Test each host independently, including plan and workspace restrictions. Keep the website as a shareable public surface and account/support companion. Core participation should be possible through chat. [Package formats](https://developers.openai.com/plugins/build/plugins), [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).

The first integration proof must resolve identity and signup. Current Sign in with ChatGPT identity is a limited commercial-partner trial; Buildmates access is unverified. If available, validate the signed identity on the server and create or resume the internal account. Otherwise use a supported one-time authentication handoff and resume setup in chat. Preserve existing GitHub users through explicit account linking; never join accounts by an unverified email or name. [Sign-in for plugins](https://developers.openai.com/siwc/chatgpt-plugin).

Add MCP Apps UI resources for profile review, introductions, room messages, Circles, and controls. Keep each operation usable conversationally where a host does not render that UI. No MCP UI resource registration was found in the inspected current server. Account state, membership, approvals, messages, and revisions remain canonical backend data across chats and hosts. The embedded room is a Buildmates conversation, not a transfer of users' private ChatGPT conversations. [Embedded UI](https://developers.openai.com/plugins/build/chatgpt-ui).

Context collection must adapt to the host: approved project folders and tools in Codex; user-supplied descriptions, links, uploads, and genuinely available sources in ChatGPT. Sign-in does not grant access to conversation history. Do not require local continuity files or all-project inventory for the ChatGPT path.

Background behavior requires a separate capability proof. Current MCP Events supports selected ChatGPT Work/cloud surfaces and requires MCP 2.0, persistent subscriptions, and signed webhooks. It is not blanket always-on support in every ordinary ChatGPT conversation. Distinguish live event delivery, host scheduling, backend deterministic maintenance, and agent evaluation; each user's consent remains independent. [MCP Events](https://developers.openai.com/plugins/build/mcp-events).

## Reliability and operating work

The focused test run exposed a clock mismatch: `verifySetupEvidence` in `packages/mcp-core/src/server.ts:705` uses `Date.now()` while the contract fixture injects July 15 through `services.now`. Rich and sparse completion fail with `setup_evidence_missing` at the networking-pulse step. This demonstrates nondeterministic verification; it does not establish that a freshly created production pulse is broken. Use the shared clock consistently and test future, expired, and exact-boundary pulses.

Git history identifies the MCP registry, onboarding skills, and public agent instructions as recurrent change and repair areas. All recorded commits are from one author. Consolidate duplicated instructions and package generation, then split tool handlers along existing domain boundaries as those areas change. Preserve the transport-independent registry and security checks. A new service architecture is not warranted by this inspection.

Turn the July launch diary into a concise restart authority before sustained implementation: an index, small checkpoint, substantial workstream contracts, and unresolved issue queue. Archive completed historical detail. Add repeatable CI for package validity and affected product checks; no tracked `.github` workflow directory was found.

For a public network, complete authenticated two-person QA, block/report behavior, moderation ownership, deletion/export, upload cleanup, quota monitoring, backup/restore rehearsal, and rollback proof. Existing runbooks and test coverage are a starting point, not fresh operating proof. Review actual hosting and inference costs during a pilot before selecting paid features or pricing.

The public Map needs an honest data boundary. Separate fixtures from live aggregates and move demonstrations to a labelled, isolated preview. Existing fixture cleanup affects production data and requires an exact scoped review before execution. This assessment did not delete fixtures or change production.

## Delivery order and exit gates

| Order | Work | Required result |
| --- | --- | --- |
| 1 | Establish the baseline and prove installation/authentication | Clock regression repaired; one package source; actual test installation and verified identity/account creation in ChatGPT web and Codex; external authentication steps recorded. |
| 2 | Ship conversational signup and persistence | A new user says "Sign me up", reviews the proposed fields, saves a profile, and resumes correctly in a fresh chat. Existing users do not get duplicate accounts or setup resets. |
| 3 | Add the embedded product interface | Profile review, introductions, room messages, Circles, and privacy controls work through MCP Apps where supported and through conversational tools; desktop/phone and accessibility proof. |
| 4 | Finish introductions and ongoing use | Two independently authenticated users can review, accept, converse, decline, pause, and resume; stale/private evidence and duplicate proposals are rejected. |
| 5 | Finish generated profiles and shared spaces | Natural-language design and targeted edits produce safe previews, working trusted tools, approvals, history/rollback; core matching does not depend on custom-page generation. |
| 6 | Prove background refresh and event delivery | Supported host schedules/events work with explicit consent, bounds, quiet behavior, retries, pause and revocation; unavailable capabilities are accurately represented. |
| 7 | Complete the operating gate | Honest public aggregates, support/moderation owner, incident/restore rehearsal, privacy lifecycle, capacity and cost measurements. |
| 8 | Run an invited pilot and prepare review | People from one relevant community use it without founder rescue; actual failure and conversation outcomes are recorded; a concrete review package exists. |
| 9 | Submit and publish | Review findings resolved and approval verified before publication; production smoke and authenticated acceptance checks pass for the released versions. |

These stages cover a full public release. A pilot supplies missing evidence; it does not excuse unfinished safety, privacy, or operations. Duration depends on host activation behavior, authentication proof, and what independent users reveal.

## How to judge whether it deserves five stars

Measure distinct eligible users, not token rows, clone traffic, public Map totals, or generated rooms. Exclude founder, reviewer, bot, and fixture activity from the adoption view.

Track installation/authentication failures, time to reviewed matching profile, time to first relevant suggestion, reciprocal acceptance, time to reply, user-reported usefulness, and return to refresh work or reconnect. Use structured event metadata without storing source contents or mining private messages. Audit records exist, but this inspection did not find a ready product funnel or retention report.

Suggested first pilot: 20 to 30 opt-in builders in one community. Record every setup outcome; seek at least ten independent completions, five conversations that participants explicitly describe as useful, and repeat use in the following week. These are proposed learning targets, not existing results or statistical proof. Report raw counts and reasons for failure alongside rates.

If people value profiles but not introductions, examine network density and proposal quality before building more visual features. If introductions work but rooms are unused, keep conversation lightweight and offer richer space design when requested. If people cannot finish installation, resolve that before expanding recruitment.

## Recommended starting point

Modernize the package, repair the clock baseline, and prove the actual authentication path in ChatGPT web and Codex first. Then complete "Sign me up" through reviewed profile creation and fresh-chat resumption, followed by embedded introductions and rooms. Validate through independent users before investing in more network visualizations or more modules.

Evidence expires when covered source, schema, dependencies, host capabilities, deployment configuration, or release versions change. The findings above establish today's assessment, not launch certification.
