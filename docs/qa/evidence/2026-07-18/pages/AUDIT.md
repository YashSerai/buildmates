# Buildmates rendered page audit — 2026-07-18

This run records 134 full-page screenshots: 67 desktop captures at 1280 px and
67 Pixel 7 captures. The manifest covers every page-route key from `001` through
`039`, plus the framework not-found route `042`. The same local authenticated
fixture supplies the ranked candidate spectrum, pending introduction,
Connection, room, Activity, Circle, profile, project, invite, and settings data.

## Evidence

- `manifest.csv` is the route/state authority. It records access boundary,
  fixture, viewport, console and page errors, failed requests, horizontal
  overflow, reduced-motion mode, first-control focus, first-control target size,
  status, and limitations.
- `_contact-desktop.jpg` and `_contact-phone.jpg` are visual index sheets. The
  full-resolution PNG files remain the inspection evidence.
- 102 captures are local route/state evidence: 96 pass and six are explicitly
  marked for review.
- 32 captures are public signed-out production evidence from
  `https://buildmates.yashns.chatgpt.site`: all 32 pass.

## Audit result

- No captured page has more than one pixel of rounding-level horizontal
  overflow. Production captures have zero page errors and zero actionable
  failed requests. Intentional 404 states can emit the framework's expected
  console resource error and are labeled as recovery evidence.
- No scanned page body exposed `SurfaceSpec`, profile IDs, workspace-scope
  arguments, idempotency keys, schema-validation language, or internal notes.
- The desktop and phone index review found no clipping, overlapping controls,
  split words, white-on-cream primary controls, or unstyled native dialogs in
  the captured customer routes.
- Introductions now proves the intended shared-data contract: the screenshot
  contains strong, adjacent, and weak ranked candidates alongside a pending
  reciprocal introduction. The excluded candidate and private sentinel are not
  present. Connections, the room, Activity, and Circles use the related shared
  network fixture.
- Keyboard focus was checked before each capture and then cleared so the skip
  link does not distort the visual evidence. Reduced motion was enabled for
  every capture. The first operable control was measured against the 44 px
  target where one exists.

## Exact limitations

- Six local signed-out restricted-route captures (`/account/appeal`, an unknown
  room, and an unknown Circle at both viewports) are not product-UI proof. Those
  routes correctly attempted authentication, but the local E2E server has no
  GitHub OAuth client and returned `github_login_unavailable` JSON. Safe public
  production routes were captured separately; OAuth consent was not opened.
- Global loading key `040` and forced error key `041` were source-audited but
  not captured. There is no deterministic visual trigger for either state in
  the current route harness.
- This is complete page-route coverage, not complete coverage of every state in
  the larger catalog matrix. Remaining state screenshots include every 0/10
  onboarding checkpoint; generated profile revisions and rollback; pending and
  accepted project collaboration; room upgrade/design approval states; Circle
  role/vote permutations; settings mutation failures; and operator-role views.
  Existing focused tests cover several of those behaviors, but screenshots were
  not invented where the fixture did not expose the state.
- Map and Build Graph were captured in their current local and production
  states only. Their visual/data iteration remains intentionally deferred for
  founder QA.
- The authenticated captures use simulated independent local principals and a
  local D1 fixture. They do not replace the final two-external-account login
  run.

