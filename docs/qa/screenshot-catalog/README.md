# Buildmates page screenshot catalog

This is the canonical inventory for rendered Buildmates page QA. It covers all
39 `page.tsx` routes under `apps/web/app`, plus the global loading, error, and
not-found experiences. API routes, metadata routes, and downloadable ICS files
are tested separately because they are not pages.

## Evidence layout

Each QA run stores full-page images here:

```text
docs/qa/evidence/YYYY-MM-DD/pages/
  manifest.csv
  desktop/
    001-landing--signed-out.png
  phone/
    001-landing--signed-out.png
```

Use the same filename in both viewport folders. The manifest is the authority
for route parameters, fixture identity, screenshot time, browser console result,
and pass or fail status. Do not overwrite evidence from an earlier run.

Required viewports:

- Desktop: Chromium at 1280 x 720, full-page capture.
- Phone: Chromium using the Playwright Pixel 7 profile, full-page capture.
- Add a focused 1024 px desktop capture when navigation, grids, tables, or
  generated surfaces materially change between 1280 px and phone.

Every capture must also record horizontal overflow, console errors, page errors,
failed requests, keyboard focus visibility, and whether controls meet the 44 px
  touch-target requirement. Meaningful content must remain visible with reduced
  motion enabled.

## Fixture and dynamic-route contract

Do not guess dynamic IDs from URLs.

- `POST /api/testing/session` returns the signed-in `userId` in local E2E mode.
- `POST /api/testing/populated-network` returns `pendingProposalId`,
  `connectionId`, `roomId`, `activeCircleId`, and `invitationCircleId`. Those
  values drive Introductions, Connections, rooms, Activity, and Circles in the
  same scenario, so one fixture validates multiple surfaces without weakening
  isolation.
- Profile QA creates a known handle through `PUT /api/profiles/{handle}` and
  records the returned profile ID and canonical `/builders/{handle}` URL.
- Project QA creates the project through `POST /api/projects` and records the
  returned slug. Collaboration QA records the invited collaborator user ID and
  the same slug.
- Invite QA records the token and URL returned by `POST /api/invites`; expired,
  revoked, exhausted, and invalid tokens must use separate fixture records.
- Profile surface IDs and revision IDs come from `/api/surfaces/profile`.
  Room and Circle proposal/revision IDs come from their authenticated APIs.
- Operator pages require an explicitly seeded operator role. Never reuse a
  founder or normal QA identity as an operator fixture.
- Production must never expose the testing session or populated-network routes.

## Route and state matrix

The first state in each row is the minimum launch screenshot. Additional states
are required when the state changes the layout, available actions, privacy
boundary, or recovery path.

### Public product and account pages

| Key | Route | Access | Required states |
|---|---|---|---|
| 001 | `/` | Public | Signed out landing; phone navigation open; setup-prompt modal/toast open |
| 002 | `/product` | Public | Signed out; signed in header variant |
| 003 | `/install` | Public | Signed out; signed in; setup-prompt modal/toast; copy failure fallback |
| 004 | `/privacy` | Public | Signed out; signed in header variant |
| 005 | `/terms` | Public | Signed out |
| 006 | `/support` | Public | Signed out; signed in header variant |
| 007 | `/account` | Public conditional | Signed out; GitHub authentication error; signed in before profile; signed in with published profile |
| 008 | `/account/deleted` | Public terminal | Deletion accepted |
| 009 | `/account/appeal` | Limited suspended-account identity | Suspended with eligible outcome; active identity with eligible outcome; no appealable outcomes; submission error; submission accepted |
| 010 | `/capability-check` | Public conditional | Signed out; signed in |
| 011 | `/mcp/authorize?return_to={callback}` | Public conditional | Signed out with valid callback; signed in with valid callback; authorization working; authorization error; missing callback/expired link |
| 012 | `/i/{token}` | Public conditional | Valid signed out; valid signed in; accepted; revoked/expired/exhausted token; invalid token not-found |

### Aggregate public visualizations

| Key | Route | Access | Required states |
|---|---|---|---|
| 013 | `/map` | Public | Empty; populated world view; clustered nearby cities; cluster expanded; individual city popup; tile/style failure with totals preserved; reduced motion |
| 014 | `/graph` | Public | Empty; populated root topics; focused parent topic with children and linked neighbors; return to all topics; dense labels on phone; reduced motion |

Map fixtures must include globally distributed cities and close neighbors such
as Vancouver and Burnaby. Graph fixtures must include parent-child topics,
cross-topic edges of different strengths, long labels, and enough nodes to hit
the visible-node cap.

### Profile and project pages

| Key | Route | Access | Required states |
|---|---|---|---|
| 015 | `/profile` | Signed in redirect | Redirect to editor before publication; redirect to canonical builder page after publication |
| 016 | `/profile/edit` | Signed in | Empty/new draft; populated draft; field-level visibility controls; validation error; saved success |
| 017 | `/profile/design` | Owner only | Loading; no generated designs; private preview; multiple revisions; published revision in history; validation/load error; restored revision awaiting publication |
| 018 | `/builders/{handle}` | Audience-aware | Signed out public generated surface; signed-in non-owner generated surface; owner generated surface with trusted redesign controls; approved fallback profile without generated surface; deliberately sparse profile; unavailable/private profile not-found |
| 019 | `/projects/new` | Signed in | Empty form; validation error; taxonomy choices; no taxonomy available; successful creation |
| 020 | `/projects/{slug}` | Audience-aware | Signed-out public project; signed-in owner controls; signed-in collaborator controls; links/taxonomy/updates populated; honest empty sections; unavailable/private/deleted project not-found |
| 021 | `/projects/{slug}/edit` | Owner or approved editor | Populated owner edit; approved editor edit; unauthorized not-found; validation error; save success |
| 022 | `/projects/{slug}/collaboration` | Invited collaborator | Pending invitation; accepted already; accept success; decline success; unauthorized/not-found |

Generated-surface screenshots must use real SurfaceSpec v2 fixtures and approved
bindings. A fallback profile screenshot cannot stand in for the generative
profile gate.

### Onboarding and signed-in home

| Key | Route | Access | Required states |
|---|---|---|---|
| 023 | `/onboarding` | Signed in | Each authoritative 0/10 through 10/10 checkpoint; Codex link pending/complete; storage explanation; source selection; private-context review; Work Signal review; full profile proposal; design direction before generation; private preview; Networking Pulse explanation; acceptance mode; Work Pulse explanation; completion; save error |
| 024 | `/onboarding/manual` | Signed in fallback | Empty sparse-context form; populated manual profile; validation error; saved and resumable state |
| 025 | `/home` | Signed in | No profile; profile without Networking Pulse; complete cold start; populated network counts; active and expired Pulse dates |

Onboarding screenshots must preserve the exact progress returned by
`get_setup_state`; local labels are not allowed to invent a different step
count.

### Introductions, relationships, Activity, and invitations

| Key | Route | Access | Required states |
|---|---|---|---|
| 026 | `/matches` | Signed in | Cold start; ranked candidates containing strong/adjacent/weak QA rows; excluded candidate absent; pending proposal requiring interest; viewer interested/waiting; closed/expired proposal; response success; network error |
| 027 | `/connections` | Signed in | Cold start; active populated list; management loading; management error/retry; muted; private note; reconnect reminder; feedback saved; ended Connection; reconnect pending; block/report dialog |
| 028 | `/rooms/{id}` | Active member only | New lightweight room; populated conversation; unread/read transition; message sending/error; positive-feedback upgrade unlocked; upgrade proposal awaiting second approval; approved active module; scheduling/availability/ICS fallback; custom design loading/error/private preview/both approved/published/restored; report/block dialog; ended room unavailable |
| 029 | `/inbox` | Signed in | Loading; truthful empty; mixed unread Activity; individual read; all read; new item arriving through polling; notification destinations; moderation result with appeal action; request error/retry |
| 030 | `/invite` | Signed in | No projects/no history; project choices; personal link created; project link created; copy fallback; invitation history with accepted joins; revoked link; relevance watch off/on; load/mutation error |

The matching fixture must be visible in both the algorithm evidence and the
Introductions UI. The same reciprocal scenario must then appear as exactly one
Connection, one room, and the expected Activity items.

### Circles

| Key | Route | Access | Required states |
|---|---|---|---|
| 031 | `/circles` | Signed in | Cold start; suggested group; invitation waiting; active Circle; declined/closed history; create form with admin governance; create form with voting governance; create/load error |
| 032 | `/circles/{id}` | Member-aware | Invitation awaiting decision; active member; owner; admin; ordinary member; pending-all-invites state; declined/closed state; populated and empty chat; custom generated Circle surface; admin design proposal/publish; member-vote proposal/approve/reject; active shared tools; module entries empty/populated/error; invite/promote/demote/remove/transfer/leave actions; unauthorized not-found |

Circle captures must use at least two independently authenticated principals for
permission differences. Seeded identities are acceptable for automated QA, but
must be labeled as simulated principals unless they are genuine independent
accounts.

### Settings and safety

| Key | Route | Access | Required states |
|---|---|---|---|
| 033 | `/settings/privacy` | Signed in | Empty source policies/signals/projects/events; populated policies and signals; expired signal; matching active/paused; Full Autopilot active/disabled; export pending/complete/failed; disconnect confirmation; redact context confirmation; account-deletion confirmation; mutation error |
| 034 | `/settings/automation` | Signed in | No Pulse; active Pulse; expired Pulse; manual cadence; Tuesday/Friday cadence; liveness reviewed/unreviewed; capability available/approval required/unavailable; save success/error; copied Work Pulse prompt |
| 035 | `/settings/connections` | Signed in | Codex disconnected; creating code; active one-time code/countdown; expired code; connected; disconnect success; request/rate-limit error; copy fallback |
| 036 | `/settings/safety` | Signed in | No blocks/reports; blocked builder; unblock success/error; pending/reviewing/resolved/dismissed/actioned report receipts |

All four settings pages must show the shared settings navigation and current
destination at both viewports.

### Internal and development pages

| Key | Route | Access | Required states |
|---|---|---|---|
| 037 | `/operator/moderation` | Moderator/admin only | Open queue empty/populated; report detail; appeal; action confirmation/error; normal user not-found |
| 038 | `/operator/idempotency-recovery` | Admin only | Initial; row inspected; no-effect recovery; completed-effect recovery; error; normal user not-found |
| 039 | `/surface-lab` | Development only | Five distinct SurfaceSpec v2 fixtures; loading/empty/error/stale/private/malformed states; reduced motion; production not-found |

Internal screenshots belong under `pages/internal/` in the evidence run and must
not be reused as customer-facing launch imagery.

### Global framework states

| Key | Route | Access | Required states |
|---|---|---|---|
| 040 | Global loading UI | Route transition | Desktop and phone |
| 041 | Global error UI | Forced server/client failure | Retry action; return-home action |
| 042 | Framework not-found | Public | Unknown static route; invalid dynamic builder/project/room/Circle/invite route |

## Screenshot acceptance checklist

For every required image:

- The route and state match the fixture manifest.
- No internal state names, schema terms, IDs, debug copy, or process narration
  appear in customer-facing UI.
- No horizontal overflow, clipping, overlap, split words, inaccessible contrast,
  dead controls, or unexplained disabled actions.
- The primary action, recovery action, and privacy consequence are clear.
- Empty states remain useful and truthful; populated states use the same seeded
  records as matching and automation QA.
- Loading and failure states preserve layout and explain whether data or the
  action remains safe.
- Generated profile, room, and Circle surfaces cannot displace trusted
  navigation, privacy, report, membership, or publication controls.
- Console errors, page errors, and failed requests are either zero or recorded
  as the deliberately forced failure for that screenshot.
- The page remains understandable with motion disabled and keyboard focus is
  visible on every interactive control.

Re-read `C:\Users\yashs\.codex\guides\anti-slop-design-law.md` before the final
page-by-page decision. A screenshot is evidence for review, not proof by itself.
