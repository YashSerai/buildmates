# Buildmates One-Shot Implementation Plan

> Execution mode: subagent-driven implementation with primary-thread integration gates. Bounded lanes may work in parallel only after shared contracts are committed.

> Terminal contract: when the user says `go`, execute Tasks 1–14 continuously through GitHub push, production deployment, browser/computer QA, repair, and launch readiness. Task boundaries and validation checks are internal checkpoints, not requests for renewed approval. Pause only for an irreducible human/account action defined in `GOAL.md`.

**Goal:** Ship a complete, production-ready, mobile-ready Buildmates product with a clean neutral UI that turns approved connected-app context into living builder identities, creates mutually relevant connections through independent user-side Codex evaluations, supports Manual and Full Autopilot acceptance, and sustains relationships through persistent Connections, lightweight rooms, discovery, invitations, and optional generative workspaces and Circles.

**Architecture:** One monorepo contains independently deployable `apps/web` and `apps/mcp` plus shared `packages/domain`, `packages/database`, `packages/surfaces`, `packages/matching`, and `packages/mcp-core`. ChatGPT Sites hosts the web app and Sites-managed D1/R2. MCP may co-deploy only if the complete transport/OAuth gate passes; otherwise it deploys to a Worker or Vercel and calls the web-owned internal data service with signed subject delegation. Day-one server logic is deterministic. User-side Codex automations perform private context interpretation, candidate evaluation, and surface generation.

**Tech Stack:** npm workspaces, TypeScript, Next.js 16, React 19, vinext, Cloudflare Workers, D1, Drizzle ORM, R2, Sign in with ChatGPT, GitHub OAuth fallback, Streamable HTTP MCP, Zod, Vitest, Playwright, ESLint, ChatGPT Sites, GitHub.

**Baseline references:** `GOAL.md`; `BUILD_INDEX.md`; `docs/aegis/baseline/2026-07-14-initial-baseline.md`; `docs/aegis/specs/2026-07-14-buildmates-product-design.md`; `docs/aegis/specs/2026-07-14-buildmates-architecture.md`; `docs/aegis/BASELINE-GOVERNANCE.md`; the supplied Buildmates brief; `C:\Users\yashs\.codex\guides\anti-slop-design-law.md`.

**Compatibility notes:** Preserve vinext/Worker ESM compatibility and reserved auth routes. Keep shared packages independent from application and Cloudflare globals. Treat web and MCP as separate deployment units even when co-deployed. Do not add generated JavaScript execution, server-side matching inference, embeddings, hidden connector ingestion, or external transactional email in day one. Never claim a user-selected model can be forced. Use idempotent MCP writes and server-enforced object authorization.

**TDD Route:** Mode off; decision skipped. Use proportional post-change regression with unit tests for domain invariants, integration tests for persistence/auth/MCP, and Playwright for critical user flows.

**Verification:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, D1 migration checks, MCP contract tests, local browser inspection, production phone/desktop smoke checks, and a final anti-slop audit.

## Product build spine

The full scope remains in this plan, but one complete story is sovereign and must be production-ready before expansion work consumes integration time:

1. One Codex command starts and resumes setup.
2. The user approves source-use choices and current-work summaries.
3. Codex creates a genuinely personal living profile.
4. A changed Work Signal produces a grounded “why now” match.
5. Two independent evaluations plus each user's configured Manual or Full Autopilot acceptance produce a match.
6. The match creates a persistent Connection and a lightweight themed room.
7. The members chat and complete a real Google Calendar or ICS handoff.
8. Invitations, follows, watches, discovery, globe, and graph grow the wider network even before a match exists.
9. Feedback, reconnect reminders, room upgrades, and Circles deepen the relationship loop.

Tasks 1–10 establish the core relationship loop. Execute Task 12's landing, growth, and discovery surface immediately after Task 10 and before Task 11's Circle expansion. Task numbers are stable dependency identifiers; expansion cannot block a complete, production-ready product path.

## Shared execution rules

1. Primary thread owns `packages/database/src/schema.ts`, shared domain contracts, migrations, application authorization boundaries, and merges.
2. A subagent receives a bounded file set and acceptance test. It does not redesign a shared contract silently.
3. Every lane returns changed files, commands run, failures, assumptions, and remaining risks.
4. Source-control, deployment, browser, and runtime truth are reported separately.
5. A visible control is either functional, honestly gated, or removed.
6. Generated or seeded users, projects, and metrics are labeled as test fixtures.
7. The canonical specification is updated before a product-rule change lands.

## Task 1: Freeze planning, Git, and repository truth

**Files:**

- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Move: current vinext starter into `apps/web/`
- Create: `apps/mcp/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/database/package.json`
- Create: `packages/surfaces/package.json`
- Create: `packages/matching/package.json`
- Create: `packages/mcp-core/package.json`
- Create: `LICENSE`
- Create: `.env.example`
- Create: `docs/architecture/runtime-boundaries.md`
- Create: `docs/release/requirements.md`
- Verify: `.gitignore`, `package.json`, `apps/web/.openai/hosting.json`

**Why:** Establish a clean public-facing repository and prevent product, architecture, release, and local configuration truth from drifting.

**Steps:**

1. Replace the starter README with the product line, real architecture, local setup, privacy boundaries, reproducible product-validation path, and test commands.
2. Convert the repository to npm workspaces and move the existing vinext application intact into `apps/web`; create independently buildable MCP and shared package skeletons with no duplicated domain or tool-registration logic. If nested Sites packaging fails in Task 2, preserve `apps/web` as source ownership and add only a root deployment adapter.
3. Add Zod, Vitest, Playwright, and `cross-env`; replace Unix-only inline environment-variable scripts with cross-platform workspace commands.
4. Add root `typecheck`, `test:unit`, `test:integration`, `test:contract`, `test:security`, `test:e2e`, `verify`, and `smoke:production` scripts whose targets are introduced by later tasks.
5. Add an MIT license unless repository visibility policy changes before publication.
6. Document every required environment variable without adding credentials.
7. Record the ChatGPT Sites-first adapter boundaries, automatic fallback/continuation rules, and the human-only interruption boundary.
8. Record the production release requirements and verification evidence expected from each truth layer.
9. Create a private GitHub repository named `buildmates`, set `origin`, and push the initial planning/starter commit.
10. Protect `main` from accidental force pushes through working practice; use small scoped commits even if formal GitHub branch protection is unavailable.

**Verify:**

```powershell
git status --short
git remote -v
git log -1 --oneline
npm install
npm run lint
```

**Done when:** The repository can be cloned and understood without chat context, no secret is tracked, and the initial commit is on GitHub.

## Task 2: Establish the deployable ChatGPT Sites and MCP platform

**Files:**

- Create: `apps/web/app/capability-check/page.tsx`
- Create: `apps/web/app/api/capability/d1/route.ts`
- Create: `apps/web/app/api/capability/r2/route.ts`
- Create: `apps/web/app/api/identity/link-code/route.ts`
- Create: `apps/web/app/api/internal/mcp-data/route.ts`
- Create: `apps/web/app/api/mcp/route.ts`
- Create: `apps/web/src/platform/identity.ts`
- Create: `apps/web/src/platform/d1.ts`
- Create: `apps/web/src/platform/r2.ts`
- Create: `apps/mcp/src/oauth.ts`
- Create: `apps/mcp/src/link-identity.ts`
- Create: `apps/mcp/src/server.ts`
- Create: `packages/mcp-core/src/server.ts`
- Create: `packages/mcp-core/src/tools/identity.ts`
- Create: `packages/database/src/identity-schema.ts`
- Create: `scripts/smoke-substrate.ps1`
- Create: `tests/integration/capability-gate.test.ts`
- Create: `docs/evidence/sites-capability-gate.md`
- Modify: `apps/web/.openai/hosting.json`

**Why:** Public reachability, stable identity, object authorization, MCP topology/OAuth, identity linking, and a secure cross-deployment data boundary establish the production platform. Failures select prepared adapters inside the same execution run rather than becoming planning handoffs.

**Steps:**

1. Deploy specifically from nested `apps/web` as a public ChatGPT Site. Prove anonymous non-owner reachability, production resolution of shared workspace packages, the nested hosting manifest, R2 put/read/delete, and D1 insert/read/migration behavior.
2. Prove a stable server-verifiable authenticated subject for a public non-owner. If the Site is unreachable or cannot support the required authenticated runtime, record the evidence and activate the prepared Cloudflare/Vercel web adapter; GitHub cannot repair an edge-sharing failure. If the Site is reachable but SIWC cannot supply the required subject/auth behavior, activate the GitHub OAuth `IdentityProvider` adapter and record the decision.
3. Prove private object-level authorization between two independent web users using a minimal capability record.
4. Implement one MCP protocol/tool registry in `packages/mcp-core`. Buildmates acts as an OAuth 2.1 authorization server/resource server using authorization code with PKCE, registered redirects, stable opaque MCP `sub`, refresh rotation, audience validation, and revocation. Attempt the thin Sites route adapter; if transport/OAuth fails, deploy `apps/mcp` to a Worker or Vercel.
5. For the external topology, prove a short-lived signed assertion with issuer, audience, MCP subject, action/scope, expiry, and replay-protected ID. The web resolves the active identity link itself and never accepts a caller-supplied `userId`; disable the internal route in the co-deployed topology.
6. Generate a short-lived single-use linking code in web, submit it through the OAuth-only pre-link `complete_identity_link`, consume it with compare-and-set, and prove both provider subjects map to the same internal user without email/name matching.
7. Record source-control, deployment, browser, and runtime evidence, run the substrate smoke script, then remove or protect destructive controls.

Use isolated local/staging identities for repeatable two-user authorization tests. Attempt the real public non-owner/second-account checks through available browser sessions during production validation; if no independent account can be accessed without user-only authentication, continue every other task and isolate that single live check at the end.

**Verify:**

```powershell
npm run db:generate
npm run db:migrate:local
npm run test:integration -- capability-gate
npm run build
npm run dev --workspace @buildmates/web
./scripts/smoke-substrate.ps1
```

Then run the ChatGPT Sites deployment flow and, if selected by the gate, the independent MCP deployment flow.

**Failure handling:** A failed ChatGPT Sites MCP-hosting test selects the independent MCP topology. A failed nested Sites web/auth runtime triggers the prepared Cloudflare/Vercel web adapter and GitHub OAuth path as applicable. Diagnose and repair authorization, OAuth, delegated-data, and identity-link defects inside the run. Do not return to the user for an ordinary architecture choice; pause only if the selected production path requires a human-only account, credential, billing, CAPTCHA/2FA, or owner-permission action.

**Validation continuity:** Task 5 exercises clean plugin connection; Task 6 exercises a real Work Signal; Task 8 exercises atomic match opening; Tasks 4 and 7 exercise SurfaceSpec publish/rollback; Task 9 exercises unattended automation and consequential-write classification; Task 10 exercises two-session polling, deep-link/manual handoff, and Calendar/ICS behavior. Task 13 replays the complete matrix against production. None of these checkpoints ends the implementation run.

## Task 3: Define the domain schema, repositories, and authorization core

**Files:**

- Create: `packages/database/src/schema.ts`
- Create: `packages/database/src/relations.ts`
- Create: `packages/database/src/seed.ts`
- Create: `packages/database/src/repositories/d1.ts`
- Create: `packages/database/src/repositories/memory.ts`
- Create: `packages/database/src/service-client.ts`
- Create: `packages/domain/src/types.ts`
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/permissions.ts`
- Create: `packages/domain/src/repositories.ts`
- Create: `packages/domain/src/clock.ts`
- Create: `apps/web/src/auth/require-user.ts`
- Create: `apps/web/src/auth/authorize.ts`
- Create: `tests/unit/permissions.test.ts`
- Create: `tests/integration/repositories.test.ts`
- Generate: `drizzle/*.sql`

**Why:** Every later lane needs one stable model for identity, privacy, reciprocal state, membership, revisions, and audit events.

**Steps:**

1. Define identity links/codes, users, handles, operator roles, connected-app preferences, taxonomy tables/versions, Work Signals with canonical IDs, builder match index, pair-score rows, expiring Networking Pulses, introduction budgets, quiet hours, snoozes, exclusions, watches, profiles, first-class projects and collaborators, follows, invite/share links, governed cohorts and memberships, Design Policies, surfaces, revisions, approvals, personal views, candidate batches, evaluations, human responses, matches, persistent Connections, side states, private notes, reminders, rooms, messages, feedback, upgrade proposals, Circles, roles, votes, modules, immediate/digest notifications, blocks, moderation cases/actions/appeals, reports, exports, deletion/redaction jobs, automation checkpoints, and audit events.
2. Use unique constraints for handles, normalized `(provider_channel, provider_issuer, provider_subject, workspace_scope)`, link-code hashes, unordered match pairs, one Connection/room per `match_pair_id`, client message IDs, idempotency keys, and revision numbers. The public MCP accepts only the literal `global` workspace scope until a safe multi-workspace handoff exists. Consume link codes with compare-and-set and allow only one active identity link per normalized scoped subject.
3. Store privacy and acceptance values as validated enums with explicit defaults.
4. Implement repository interfaces with D1 and in-memory adapters.
5. Implement object-level authorization helpers for owner, room member, Circle member/admin/owner, and public/cohort/connection visibility.
6. Seed labeled fictional test users and a Build Week cohort; do not seed fake adoption metrics.
7. Test that a second user cannot read or mutate private resources.
8. Generate and inspect migrations before applying them.

**Verify:**

```powershell
npm run db:generate
npm run db:migrate:local
npm test -- permissions repositories
npm run typecheck
```

**Done when:** Schema invariants and repository behavior pass against both adapters, and authorization is reusable by web and MCP routes.

## Task 4: Deploy the versioned runtime Design Policy and SurfaceSpec renderer

**Files:**

- Create: `packages/surfaces/src/design-policy.ts`
- Create: `packages/surfaces/src/seed-policy.ts`
- Create: `packages/surfaces/src/schema.ts`
- Create: `packages/surfaces/src/sanitize.ts`
- Create: `packages/surfaces/src/scope-css.ts`
- Create: `packages/surfaces/src/render.tsx`
- Create: `apps/web/components/surfaces/SurfaceRenderer.tsx`
- Create: `apps/web/components/surfaces/primitives/*`
- Create: `apps/web/app/surface-lab/page.tsx`
- Create: `tests/unit/surface-schema.test.ts`
- Create: `tests/unit/surface-sanitize.test.ts`
- Create: `tests/e2e/surface-lab.spec.ts`

**Why:** Generative profiles and rooms need wide visual freedom without granting generated code authority over data, identity, or browser execution.

**Steps:**

1. Establish a clean neutral functional component system with correct hierarchy, responsive layout, accessibility, focus, loading/empty/error/stale/permission states, and no fake or placeholder controls. Defer final brand, art direction, animation, and decorative polish until after Task 14.
2. Translate the functional and security portions of the canonical anti-slop law into a concise, product-specific, machine-readable policy; final aesthetic policy additions belong to the later UI design phase.
3. Seed it into D1 as immutable version `2026-07-15.2`; store source hash and activation time. Migration 0006's fixed `2026-07-14.1` default exists only to backfill older rows; repositories always write the selected version explicitly.
4. Define a strict SurfaceSpec whose primary structure is theme tokens, trusted component tree, content/media bindings, responsive rules, and accessibility metadata; allow optional decorative/editorial HTML/CSS regions only.
5. Reject scripts, forms, event handlers, unsafe URLs, popups, top navigation, `@import`, arbitrary `url()`, dangerous CSS, global selectors, fixed overlays, and unapproved network references.
6. Render decorative/editorial HTML/CSS in a sandboxed iframe without scripts, forms, same-origin privilege, popups, or top navigation. The R2 upload/serve path allowlists passive raster image types, forbids HTML and SVG, forces trusted content types with `X-Content-Type-Options: nosniff`, and keeps every authorization-dependent response non-cacheable. Keep follow/connect/report/privacy/navigation/data controls outside the iframe.
7. Create a protected surface lab with realistic long/short content, phone/desktop previews, dark/light contrast checks, and malformed-spec error states.
8. Store policy version on every generated revision. Dispatch reads through a versioned parser/policy registry so registered historical revisions remain renderable and asset-authorizable; bind each parser to the exact policy id, canonical source and source hash, and fail closed for unknown or retired entries. New authoring defaults to the active policy while revision creation must explicitly select a registered, activated, creation-allowed policy.
9. Test CSS scoping, sandbox escape attempts, XSS payloads, keyboard navigation, reduced motion, overflow, and fallback rendering.

**Verify:**

```powershell
npm test -- surface-schema surface-sanitize
npm run test:e2e -- surface-lab
npm run build
```

**Done when:** Two structurally different neutral SurfaceSpecs render responsively through trusted components, decorative regions remain isolated, a malicious spec is rejected, and no generated instruction can bypass application permissions.

## Task 5: Build the Buildmates MCP app and per-app onboarding contract

**Files:**

- Create: `plugin/.codex-plugin/plugin.json`
- Create: `plugin/.app.json`
- Create: `plugin/README.md`
- Create: `plugin/skills/buildmates-onboarding/SKILL.md`
- Create: `plugin/skills/buildmates-work-pulse/SKILL.md`
- Create: `plugin/skills/buildmates-matching/SKILL.md`
- Create: `plugin/skills/buildmates-surfaces/SKILL.md`
- Modify: `apps/mcp/src/server.ts`
- Modify: `packages/mcp-core/src/server.ts`
- Create: `packages/mcp-core/src/tools/*.ts`
- Create: `packages/mcp-core/src/schemas.ts`
- Create: `packages/domain/src/setup/state-machine.ts`
- Create: `tests/contract/mcp-tools.test.ts`
- Create: `docs/architecture/mcp-contract.md`

**Why:** The plugin is the single required entry point and must coordinate existing connected apps without receiving their credentials or overstating what is visible.

**Steps:**

1. Use the installed plugin-creation guidance to confirm the current package format, then keep only `plugin.json` inside `.codex-plugin`; use root `.app.json` as the canonical remote Buildmates app registration and avoid duplicate direct MCP registration. Reference the real Buildmates app ID after it is created.
2. Define the unlinked first run exactly: plugin OAuth creates an opaque MCP principal; `get_link_url` sends the user to HTTPS Buildmates web; the user signs in and obtains/approves a short-lived code; Codex submits it through `complete_identity_link`; only then do setup tools unlock.
3. Define concise skills for onboarding, Work Pulse extraction, reciprocal evaluation, feedback, and surface generation.
4. In onboarding, have Codex present sources it can confidently identify in the current conversation, declared optional dependencies such as Google Calendar, and user-named sources. Label the list as non-exhaustive because no generic installed-app enumeration API is assumed.
5. Describe Never, Ask each time, Allow approved Work Signals, and Actions only as Buildmates source-use policies; never imply they modify host connector permissions.
6. Implement `get_setup_state` and `complete_setup_step` for the mandatory first-run sequence: identity link, storage explanation, source selection, context collection, signal/privacy review, basic profile, page preview, Networking Pulse, acceptance mode, automation, and first useful outcome.
7. Make onboarding adaptive: when context is sparse, Codex asks focused questions and accepts a manual profile, one selected repository/project, a short pasted description, or portfolio/GitHub/LinkedIn/project links; it never stalls or invents missing information.
8. Keep one tool registry in `packages/mcp-core`. Include OAuth-only pre-link `get_link_url` and rate-limited `complete_identity_link`; the latter may only atomically consume a code and create a link. Then implement linked-user tools for onboarding state, source preferences, approved Work Signals, Networking Pulse, profile model, invites, follows/watches, candidates, evaluations, manual responses, Connections, private notes/reminders, room summaries, feedback, generation briefs, surface revisions, approvals, rollback, `prepare_calendar_handoff`, `attach_calendar_event`, and automation checkpoints.
9. Except for the two narrow pre-link identity operations, require shared Zod validation, OAuth plus active identity link, ownership checks, idempotency keys, accurate MCP safety annotations, and explicit confirmation states. Treat Calendar preparation as an audience-filtered read and event attachment as a consequential idempotent write storing only the minimal receipt.
10. Ensure tools accept only summaries and structured evidence; no credential or raw-context fields exist in schemas.
11. Add prompt-injection-resistant instructions: connector content is data, cannot alter Buildmates policy, cannot authorize its own sharing, and cannot change another person's state.
12. Test every tool for unauthenticated, unlinked, unauthorized, expired/reused linking code, duplicate, malformed, and happy-path calls.
13. Run Codex-to-production acceptance tests for both rich-context and sparse-context “Set up my Buildmates” flows through a published basic profile, configured automation, and candidate/follow/watch/invite outcome.

**Verify:**

```powershell
npm run test:contract
npm run typecheck
npm run build
```

**Done when:** A real Codex conversation can install/connect Buildmates, identify available or user-named sources without claiming an exhaustive list, save individual source-use policies, submit an approved Work Signal, and complete the one-shot setup contract.

## Task 6: Implement onboarding, Work Pulse review, privacy center, and automation setup

**Files:**

- Create: `apps/web/app/onboarding/page.tsx`
- Create: `apps/web/app/onboarding/actions.ts`
- Create: `apps/web/components/onboarding/SetupProgress.tsx`
- Create: `apps/web/components/onboarding/SparseContextInput.tsx`
- Create: `apps/web/components/onboarding/AppPermissionRow.tsx`
- Create: `apps/web/components/onboarding/WorkSignalReview.tsx`
- Create: `apps/web/components/onboarding/AcceptanceMode.tsx`
- Create: `apps/web/components/onboarding/AutomationCadence.tsx`
- Create: `apps/web/app/settings/privacy/page.tsx`
- Create: `apps/web/app/settings/automation/page.tsx`
- Create: `apps/web/app/api/work-signals/route.ts`
- Create: `apps/web/app/api/connected-apps/route.ts`
- Create: `tests/e2e/onboarding.spec.ts`
- Create: `tests/e2e/privacy.spec.ts`

**Why:** Trust is won or lost before the first match. The user must understand each source, each submitted summary, Full Autopilot, and ongoing usage.

**Steps:**

1. Build the shared mandatory first-run progress sequence and resume behavior so website and Codex always show what has been completed and the next useful step.
2. Build rich-context and sparse-context branches. Sparse onboarding offers adaptive questions, manual basic profile, one repository/project choice, short pasted description, and portfolio/GitHub/LinkedIn/project links.
3. Show each identified source individually with Never, Ask each time, Allow approved Work Signals, and Actions only when supported; label these as Buildmates source-use policies, not host permission controls.
4. Explain that Codex reads under existing host app permissions, while Buildmates receives only approved summaries and cannot enumerate every installed app generically.
5. Let users edit/reject Work Signals and choose Show on profile, Use privately for matching, or keep it outside Buildmates.
6. Present Manual and Full Autopilot clearly with the two-independent-evaluation requirement.
7. Recommend Luna High for routine automation and Luna Extra High for initial generative work without claiming enforcement.
8. Build “What Buildmates knows about me” with per-source revoke, disconnect-all, expiry, project/signal deletion, export, pause matching, and disable-autopilot controls.
9. Add similar/adjacent, local/global, temporary intent, maximum introductions per week, quiet hours, snooze, serendipity, exclusions, cluster-diversity, expiry, and reconfirmation controls.
10. Test rich/sparse completion, adaptive questioning, partial resume, unavailable connector, insufficient context, stale signal, revocation, Full Autopilot capability fallback, expired Networking Pulse, and mobile keyboard flows.

**Verify:**

```powershell
npm run test:e2e -- onboarding privacy
npm run lint
npm run typecheck
```

**Done when:** A new user can finish onboarding with no hidden permission and later audit or revoke everything Buildmates stores.

## Task 7: Build profile generation, review, publication, and revision governance

**Files:**

- Create: `apps/web/app/profile/edit/page.tsx`
- Create: `apps/web/app/profile/design/page.tsx`
- Create: `apps/web/app/builders/[handle]/page.tsx`
- Create: `apps/web/app/projects/[slug]/page.tsx`
- Create: `apps/web/app/projects/new/page.tsx`
- Create: `apps/web/app/projects/[slug]/edit/page.tsx`
- Create: `apps/web/app/api/projects/route.ts`
- Create: `apps/web/app/api/projects/[slug]/route.ts`
- Create: `apps/web/app/api/projects/[slug]/collaborators/route.ts`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/app/api/profiles/[handle]/route.ts`
- Create: `apps/web/app/api/surfaces/profile/route.ts`
- Create: `apps/web/components/profile/ProfileReview.tsx`
- Create: `apps/web/components/surfaces/RevisionPreview.tsx`
- Create: `apps/web/components/surfaces/RevisionHistory.tsx`
- Create: `packages/surfaces/src/profile-brief.ts`
- Create: `tests/integration/profile-visibility.test.ts`
- Create: `tests/e2e/profile-generation.spec.ts`
- Create: `tests/e2e/profile-contrast-pair.spec.ts`

**Why:** Generative profiles are the visible proof that Codex can turn current work into a personally expressive public surface without exposing private matching context.

**Steps:**

1. Build structured profile review for identity, current and previous projects, interests, ambitions, stage, active areas of exploration, optional offers/needs, networking intentions, cohorts, and field visibility.
2. Generate a surface brief containing only authorized bindings and the active Design Policy.
3. Accept a Codex-generated SurfaceSpec as a private revision.
4. Render desktop and phone previews with validation errors shown outside the public page.
5. Publish using an optimistic base-version check; preserve history and rollback.
6. Enforce public, member, cohort, connection, and private field visibility on the server.
7. Add honest empty states for users without projects or current Work Signals.
8. Test a distinctive seeded profile, long content, missing image, private field leakage, stale revision conflict, rollback, and public anonymous viewing.
9. Prove two seeded profiles have materially different composition, information hierarchy, typography, and signature elements—not only different colors—while preserving responsive and accessibility behavior.
10. Build complete project create/edit/publish/archive/restore/delete/transfer behavior with status, stage, topics, tools, links, media, update history, per-project visibility, matching permission, and collaborator invitation/permissions.
11. Build project-detail routes and verify the canonical `/@handle` URL through a vinext-compatible rewrite to `/builders/{handle}` rather than an App Router `@` folder.
12. Add owner-controlled profile statistics for mutual connections, public projects, introductions, Circles, shipping activity, and custom metrics. Label system-, connector-, and self-reported values; exclude followers/popularity ranks and allow counts to be hidden. Keep token usage private and absent unless a reliable Codex signal is capability-verified and explicitly published.

**Verify:**

```powershell
npm test -- profile-visibility
npm run test:e2e -- profile-generation profile-contrast-pair
npm run build
```

**Done when:** Codex can create and revise a distinctive profile without a deployment, and private data never appears in public output or page metadata.

## Task 8: Implement deterministic retrieval and the reciprocal match state machine

**Files:**

- Create: `packages/matching/src/taxonomy.ts`
- Create: `packages/matching/src/normalize.ts`
- Create: `packages/matching/src/builder-index.ts`
- Create: `packages/matching/src/features.ts`
- Create: `packages/matching/src/score.ts`
- Create: `packages/matching/src/retrieve.ts`
- Create: `packages/matching/src/explain.ts`
- Create: `packages/matching/src/state-machine.ts`
- Create: `packages/matching/src/fixtures.ts`
- Create: `apps/web/app/api/matches/candidates/route.ts`
- Create: `apps/web/app/api/matches/evaluations/route.ts`
- Create: `apps/web/app/api/matches/respond/route.ts`
- Create: `tests/unit/matching-score.test.ts`
- Create: `tests/unit/match-state-machine.test.ts`
- Create: `tests/integration/match-idempotency.test.ts`
- Create: `docs/evidence/matching-evaluation.md`

**Why:** The main technical differentiator must be explainable, reciprocal, cheap, and impossible for one person's automation to complete on behalf of another.

**Steps:**

1. Define versioned topics, aliases, relationships, tools, domains, stages, and collaboration intents; require Work Signals, profiles, projects, and Networking Pulses to store the relevant taxonomy version and canonical IDs. Map problems/interests to topics, ambitions to goals/collaboration intents, and communities to governed cohort/community IDs.
2. Build a versioned denormalized `builder_match_index` and incremental rebuild triggers for material Work Signal, profile, project, cohort, Networking Pulse, expiry, visibility, pause, and block changes. Invalidate every pair-score row involving the changed builder.
3. Define versioned mutual-relevance score components for current-work overlap, interests, ambitions, stage, location, community, tool/domain adjacency, collaboration fit, optional offer/need complementarity, timezone, cohort, freshness, confidence, exclusions, prior declines, cluster repetition, and bounded serendipity.
4. Create labeled fictional fixture pairs with relevant, vocabulary-alias, adjacent, borderline, and harmful/blocked cases.
5. Use GPT-5.6 Sol High during offline algorithm design/review to challenge taxonomy coverage, features, weights, and failure cases; commit only deterministic taxonomy/weights/fixtures, never a production model call.
6. Store both builder-index versions, taxonomy/weight versions, evidence IDs, and audience decisions on pair-score rows. At retrieval, reject stale versions and reapply expiry/block/visibility checks even if a rebuild job has not run. Return the top 20–30 with only viewer-authorized component evidence; omit or neutralize private contributions. The user-side automation evaluates and selects from this batch. Exclude sensitive traits.
7. Implement side-specific Codex evaluations, side-specific human responses, expiry, undo-before-open, and immutable terminal states.
8. Cover all four Manual/Full Autopilot combinations.
9. In the capability-gated D1 atomic operation, derive both actors from authentication and verify the same current proposal, valid evidence/index versions, unexpired state, no block/pause, and current Manual/Full Autopilot capability requirements. Key uniqueness to `match_pair_id` and insert the Connection, both side records, room, both memberships, terminal transition, notifications, and audit event in the same transaction.
10. Enforce unique unordered pairs and idempotency so duplicated automation calls or proposal retries do not duplicate matches, Connections, or rooms.
11. Invalidate unopened proposals, evidence, explanations, and notifications when a source/signal is revoked; remove automatic acceptance from unopened proposals when Full Autopilot is disabled or matching is paused.
12. Separate stable match-pair identity from immutable versioned proposal attempts so a materially new evidence version can rematch after cooldown without overwriting history.
13. Apply similar/adjacent, local/global, exclusions, expiry, and cluster-diversity preferences before ranking; apply introduction budgets at proposal/opening, snooze at proposal delivery, and quiet hours only to notification scheduling.
14. Test alias normalization, incremental index rebuild, top-30 retrieval, race conditions, stale evaluations, defer/revisit, all four acceptance combinations, capability-required fallback, changed modes, blocks, deletion, and simultaneous approval.

**Verify:**

```powershell
npm test -- matching-score match-state-machine match-idempotency
npm run typecheck
```

**Done when:** Canonical vocabulary differences normalize correctly, deterministic top-30 retrieval is fast and inspectable, every acceptance matrix case passes, and no one-sided or duplicate Connection/room creation is possible without backend inference.

## Task 9: Build matches UI, notifications, and automation loop

**Files:**

- Create: `apps/web/app/matches/page.tsx`
- Create: `apps/web/app/matches/[id]/page.tsx`
- Create: `apps/web/components/matches/MatchCard.tsx`
- Create: `apps/web/components/matches/MatchStatus.tsx`
- Create: `apps/web/components/matches/MatchExplanation.tsx`
- Create: `apps/web/app/notifications/page.tsx`
- Create: `packages/domain/src/automation/buildmates-run.ts`
- Create: `packages/domain/src/notifications/inbox.ts`
- Modify: `plugin/skills/buildmates-matching/SKILL.md`
- Create: `tests/e2e/reciprocal-match.spec.ts`

**Why:** Users must see exactly why a match exists and which independent action is pending without confusing “agent approved” with “person accepted.”

**Steps:**

1. Render candidate cards with a viewer-specific mutual-relevance explanation grounded only in evidence that viewer is currently authorized to see. Emphasize interesting overlap, adjacency, ambitions, stage, place, or community; show offers/needs only when relevant. Create the shared explanation only after mutual authorization and show it in the opened room.
2. Use explicit statuses: awaiting your Codex, awaiting your tap, awaiting their automation, awaiting their tap, opened, declined, expired.
3. Implement Interested, Pass, undo-before-open, and report/block actions.
4. Build a single automation run that refreshes approved signals, processes a bounded shortlist and inbound proposals, records evaluations, and returns a concise notification summary.
5. Keep the run context bounded by candidate cap and changed-since checkpoint.
6. Record checkpoints and idempotency keys so retries are safe.
7. Test manual/manual, auto/manual, manual/auto, auto/auto, declined, expired, and offline-retry flows with two independent users.
8. Add an honest no-strong-match state that preserves watches and explains that Buildmates will notify the user when a relevant person joins or their work changes.
9. Deliver invitations, accepted matches, new messages, Calendar proposals, Circle invitations, reconnect requests, moderation outcomes, and security events immediately to the in-app inbox; reserve automations for intelligence refreshes and digests. Show a truthful in-site fallback when host push is unavailable.
10. Certify canonical gates 6–11 in order: clean plugin connection, real approved Work Signal, unattended automation call, persisted consequential-write capability, concurrent atomic Connection/room creation, and SurfaceSpec publish/rollback.

**Verify:**

```powershell
npm run test:e2e -- reciprocal-match
npm test -- match-state-machine
npm run build
```

**Done when:** The seeded two-user flow reaches a room through the expected independent decisions, and every pending state is truthful.

## Task 10: Build persistent Connections, lightweight rooms, scheduling, and intro memory

**Files:**

- Create: `apps/web/app/rooms/[id]/page.tsx`
- Create: `apps/web/app/connections/page.tsx`
- Create: `apps/web/app/connections/[id]/page.tsx`
- Create: `apps/web/app/api/connections/[id]/route.ts`
- Create: `apps/web/app/api/connections/[id]/notes/route.ts`
- Create: `apps/web/app/api/connections/[id]/reminders/route.ts`
- Create: `apps/web/app/api/rooms/[id]/messages/route.ts`
- Create: `apps/web/app/api/rooms/[id]/feedback/route.ts`
- Create: `apps/web/app/api/rooms/[id]/upgrade-proposals/route.ts`
- Create: `apps/web/components/rooms/RoomShell.tsx`
- Create: `apps/web/components/rooms/MatchContext.tsx`
- Create: `apps/web/components/rooms/Chat.tsx`
- Create: `apps/web/components/rooms/ScheduleHandoff.tsx`
- Create: `apps/web/components/rooms/FeedbackPrompt.tsx`
- Create: `packages/domain/src/rooms/progression.ts`
- Create: `packages/domain/src/calendar/ics.ts`
- Create: `packages/domain/src/calendar/handoff.ts`
- Create: `tests/integration/room-auth.test.ts`
- Create: `tests/integration/messages.test.ts`
- Create: `tests/e2e/room-progression.spec.ts`
- Create: `tests/e2e/connection-lifecycle.spec.ts`

**Why:** The initial room should reduce the awkwardness of a first message, stay lightweight, and learn from outcomes without mining private chat.

**Steps:**

1. On reciprocal acceptance, atomically create one persistent Connection and one lightweight room. Store why/when the people met and only mutually authorized shared context.
2. Build the Connections index and detail surfaces with side-specific active/muted/ended state, derived pair state, associated rooms/meetings/Circles, approved public updates, reconnect reminders, and per-user private notes.
3. Theme the room through SurfaceSpec while keeping chat behavior in trusted primitives.
4. Implement paginated persisted messages, bounded polling, optimistic send, client IDs, retry, unread checkpoints, loading/empty/error states, long-text/code handling, and member-only authorization.
5. Add side-specific private availability proposals, approved-window intersection, asynchronous propose/accept/counter, optional agenda from mutually visible context, and ICS fallback.
6. Implement four scheduling paths: capability-verified `codex://` continuation, copyable scheduling prompt, in-Buildmates propose/accept/counter, and ICS. In the Codex path, `prepare_calendar_handoff` returns authorized participants/timezones/windows/agenda; Codex invokes Google Calendar and receives user confirmation; `attach_calendar_event` stores only a minimal action receipt.
7. Trigger structured feedback after a meaningful interaction or explicit request; never analyze raw messages for matching.
8. Store useful/not useful, reasons, similar-match preference, follow-up intent, and private structured note under correct visibility.
9. Add renewed-relevance notifications when approved public work changes. Make mute personal; make either side's end revoke future connection-only disclosure and new messages for both; preserve exportable history; require a new mutual handshake to reconnect.
10. On positive feedback, let Codex propose a specific upgrade and explain the modules; do not enable them yet.
11. Test non-member access, private-note isolation, mute/end/reconnect, blocked member, duplicated message, deleted room, empty chat, narrow phone, feedback privacy, Calendar action receipt, and upgrade gating.
12. Certify canonical gate 12 with two independent polling sessions, then gate 13 for deep-link/copy/manual behavior and gate 14 for Calendar or ICS fallback.

**Verify:**

```powershell
npm test -- room-auth messages
npm run test:e2e -- room-progression connection-lifecycle
npm run build
```

**Done when:** Two people retain a useful Connection independent of room upgrades, can reliably chat and schedule, private notes/content stay private, renewed relevance can bring them back together, and positive feedback produces an optional—not automatic—upgrade proposal.

## Task 11: Implement shared room revisions, upgrades, Circles, roles, and voting

**Files:**

- Create: `apps/web/app/rooms/[id]/design/page.tsx`
- Create: `apps/web/app/rooms/[id]/upgrade/page.tsx`
- Create: `apps/web/app/circles/[id]/page.tsx`
- Create: `apps/web/app/circles/[id]/settings/page.tsx`
- Create: `apps/web/app/api/rooms/[id]/revisions/route.ts`
- Create: `apps/web/app/api/circles/[id]/route.ts`
- Create: `apps/web/app/api/circles/[id]/proposals/route.ts`
- Create: `apps/web/app/api/circles/[id]/votes/route.ts`
- Create: `packages/domain/src/circles/triadic-closure.ts`
- Create: `packages/domain/src/circles/governance.ts`
- Create: `apps/web/components/modules/*`
- Create: `tests/unit/triadic-closure.test.ts`
- Create: `tests/integration/surface-approval.test.ts`
- Create: `tests/integration/circle-roles.test.ts`
- Create: `tests/e2e/circle-governance.spec.ts`

**Why:** This proves the generative UI model can deepen successful relationships without overwhelming first-time chat or allowing one member to rewrite shared behavior.

**Steps:**

1. Let either room member request a design draft and keep it private until submitted.
2. Require both members to approve a shared room redesign; allow private personal views without shared approval.
3. Require separate member consent for behavioral upgrade modules.
4. Enforce base revision, conflict UI, history, approval record, publication, and rollback.
5. Detect triadic-closure candidates from reciprocal relationships and use proposed/invited/accepted/declined/active states; reveal only a privacy-safe purpose until all required invitees opt in.
6. Make a user creator owner/admin; for a suggested Circle, make the first creation accepter provisional owner and activate only after required consent. Implement promote, revoke admin, transfer ownership, remove, leave, and last-owner protections.
7. Allow member proposals with admin publishing by default or configurable member voting/quorum.
8. Implement a small approved module set: resource shelf, experiment tracker, decision log, feedback queue, milestone tracker, and opt-in local scoreboard.
9. Require explicit approval for tracker and leaderboard rule changes and record rule history.
10. Invalidate design approvals when membership, block state, role, or governance version changes.
11. Test relationship-graph non-disclosure before acceptance, unauthorized publish, stale revision, admin removal, owner transfer, vote quorum, opt-out ranking, and rollback.

**Verify:**

```powershell
npm test -- triadic-closure surface-approval circle-roles
npm run test:e2e -- circle-governance
npm run build
```

**Done when:** A positive room can be safely upgraded, a three-person Circle can form with explicit consent, and roles/governance are enforced server-side.

## Task 12: Build cold-start growth, discovery, build graph, globe, cohort, and home surfaces

**Files:**

- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/home/page.tsx`
- Create: `apps/web/app/discover/page.tsx`
- Create: `apps/web/app/graph/page.tsx`
- Create: `apps/web/app/globe/page.tsx`
- Create: `apps/web/app/cohorts/[slug]/page.tsx`
- Create: `apps/web/app/cohorts/new/page.tsx`
- Create: `apps/web/app/cohorts/[slug]/settings/page.tsx`
- Create: `apps/web/app/api/cohorts/route.ts`
- Create: `apps/web/app/api/cohorts/[slug]/members/route.ts`
- Create: `apps/web/app/invite/[token]/page.tsx`
- Create: `apps/web/app/api/invites/route.ts`
- Create: `apps/web/app/api/follows/route.ts`
- Create: `apps/web/app/api/watches/route.ts`
- Create: `apps/web/components/growth/ShareCard.tsx`
- Create: `apps/web/components/growth/InviteBuilder.tsx`
- Create: `apps/web/components/discovery/SearchFilters.tsx`
- Create: `apps/web/components/discovery/ResultList.tsx`
- Create: `apps/web/components/discovery/BuildGraph.tsx`
- Create: `apps/web/components/discovery/BuildGlobe.tsx`
- Create: `packages/domain/src/discovery/query.ts`
- Create: `tests/e2e/discovery.spec.ts`

**Why:** A new user must receive value and help grow the network even when no strong match exists; discovery must work as a coherent product rather than depending on automatic introductions alone.

**Steps:**

1. Use the shared neutral functional component system; prioritize correct page structure, user flows, responsive behavior, accessibility, and complete loading/empty/error/stale/permission states. Do not begin final brand, marketing art direction, animation, custom-profile aesthetics, or globe/graph styling in this task.
2. Build the complete landing story around approved current work → living personal profile → passive mutual relevance → configured acceptance → persistent Connection → chat/scheduling → renewed relevance or optional workspace/Circle, without invented metrics or testimonial logos.
3. Build an authenticated home showing current work freshness, Networking Pulse, next required action, watches, matches, Connections, rooms, and Circles.
4. Implement server-filtered discovery by topic, problem, tool, offer, need, location, timezone, cohort, and collaboration style.
5. Build the graph from authorized public/connection data with profile/project navigation. Require every represented member to approve relational room, Connection, collaborator, or Circle edges; otherwise expose only aggregate activity.
6. Build the globe from opt-in coarse locations only, suppress cells with fewer than five builders, avoid exact timestamps in sparse regions, and keep individual profile-city consent separate.
7. Provide accessible list equivalents for graph and globe, keyboard navigation, reduced motion, and useful empty/error states.
8. Implement cohort create/edit, public/request/invite/private visibility, join request, approval/decline, leave, removal, admin promotion/revocation, ownership transfer, archive/delete, and last-owner protection. Seed the OpenAI Build Week 2026 cohort as clearly community-created.
9. Add shareable profile/project links, personal invites, cohort-admin invites, “invite a builder whose work you follow,” and shareable “I’m building X” connection cards with expiry, revocation, quotas, repeated-recipient suppression, blocks, reporting, and rate limits.
10. Add project/topic/cohort follows and “notify me when someone relevant joins” watches.
11. Build an honest no-match state that preserves the watch, offers discovery and inviting, and never fabricates candidates.
12. Add owner-controlled search-engine indexability, canonical URLs, public-only metadata/social previews, neutral unfurls for restricted links, and share-card revocation.
13. Add production-backed aggregate counters for builders, public projects, Connections, cohorts, and scheduled meetings; omit unavailable metrics instead of seeding public claims.
14. Test invite abuse controls, cohort lifecycle/authorization, graph-edge consent, indexing/unfurl privacy, share-card revocation, counter accuracy/empty state, follow/watch notifications, phone and desktop layouts, no location permission, no results, API failure, keyboard controls, and back/forward navigation.

**Verify:**

```powershell
npm run test:e2e -- discovery
npm run lint
npm run build
```

**Done when:** A user in an empty or sparse network can publish, explore, follow, invite, share, and wait for a relevant notification; discovery controls work and the graph/globe carry real navigation value rather than decoration.

## Task 13: Complete safety, lifecycle, observability, and production verification

**Files:**

- Create: `apps/web/app/settings/account/page.tsx`
- Create: `apps/web/app/api/account/export/route.ts`
- Create: `apps/web/app/api/account/delete/route.ts`
- Create: `apps/web/app/api/report/route.ts`
- Create: `apps/web/app/reports/[id]/page.tsx`
- Create: `apps/web/app/operator/moderation/page.tsx`
- Create: `apps/web/app/api/operator/moderation/[id]/route.ts`
- Create: `packages/domain/src/moderation/cases.ts`
- Create: `packages/domain/src/privacy/redaction.ts`
- Create: `apps/web/src/security/rate-limit.ts`
- Create: `apps/web/src/security/audit.ts`
- Create: `apps/web/src/security/content-security-policy.ts`
- Create: `apps/web/src/observability/events.ts`
- Create: `scripts/production-smoke.ts`
- Create: `tests/security/authorization-matrix.test.ts`
- Create: `tests/security/generated-surface-attacks.test.ts`
- Create: `tests/integration/account-lifecycle.test.ts`
- Create: `tests/integration/moderation-lifecycle.test.ts`
- Create: `tests/integration/shared-context-redaction.test.ts`
- Create: `docs/evidence/release-verification.md`

**Why:** A networking product with private context, generated UI, and autonomous evaluations cannot ship with only happy-path demonstrations.

**Steps:**

1. Implement account export, deletion, source revocation, block, report, pause matching, mute/end Connection, and leave-room/Circle flows.
2. Implement operator moderation roles, report statuses, queue, content hide/remove, account restriction/suspension, impersonation/safety reason codes, evidence preservation, user-visible outcomes, and appeal/review without giving operators general access to private Work Signals or notes.
3. Define cross-Circle/cohort block behavior: disable direct interactions and relationship disclosure, offer limited coexistence or leave, and open an admin/operator case only when a report is filed.
4. Implement shared-context redaction: invalidate future use, regenerate affected surfaces, remove the user's contributed field from future responses/exports, preserve independently retained messages/notes, and keep a content-free audit marker.
5. Apply rate limits to MCP mutations, messages, invites, reports, candidate refreshes, and surface submissions.
6. Add audit events for permission changes, match transitions, role changes, publishes, rollbacks, moderation, redactions, exports, and deletions without secret payloads.
7. Apply a CSP compatible with sanitized generated surfaces and approved assets.
8. Run an authorization matrix across anonymous, owner, connection, room member, Circle member, cohort member/admin, operator, blocked, ended, and deleted identities.
9. Run generated-surface attacks including XSS, CSS escape, remote beacon, overlay, hidden form, event handler, data URL, and oversized payload cases.
10. Build a production smoke script for public landing, auth boundary, profile, D1 health, MCP initialize, member-only denial, and seeded fixture read.
11. Replay canonical capability gates 1–14 against production and record each result or selected fallback without collapsing source-control, deployment, browser, and runtime evidence.
12. Inspect phone and desktop pages including lower sections, loading, empty, error, long content, reduced motion, keyboard focus, console, and failed network requests.
13. Re-read the canonical anti-slop design law and remove generic, unsupported, decorative, or inconsistent work.

**Verify:**

```powershell
npm run test:security
npm run test:integration -- account-lifecycle moderation-lifecycle shared-context-redaction
npm run test:e2e
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:production -- --base-url $env:BUILDMATES_BASE_URL
```

**Done when:** All verification layers are recorded separately, no critical or high-severity issue remains, and privacy/security controls work in production.

## Task 14: Release the complete Buildmates product

**Files:**

- Modify: `README.md`
- Create: `docs/release/operator-guide.md`
- Create: `docs/release/user-testing.md`
- Create: `docs/release/architecture-diagram.md`
- Create: `docs/release/privacy-and-data-flow.md`
- Create: `docs/release/final-checklist.md`
- Create: `CHANGELOG.md`

**Why:** Buildmates needs a reproducible, supportable production release with complete user flows and evidence—not a demo-only deployment.

**Steps:**

1. Freeze reproducible fixtures covering sparse-network cold start, invitations, both acceptance modes, persistent Connections, chat, scheduling, renewed relevance, room upgrades, and Circles.
2. Write operator instructions for Sites resources, migrations, policy versions, plugin sharing, automation limitations, rollback, and incident response.
3. Write user-testing instructions for a genuine connected-context onboarding path and an independent two-user path.
4. Add architecture and privacy diagrams using only implemented capabilities.
5. Verify every public, authenticated, MCP, automation, Calendar, invitation, connection, room, and Circle flow against production.
6. Confirm GitHub visibility and licensing, push the release tag, and verify the production deployment from a clean signed-out browser and two signed-in identities.
7. Record source-control, deployment, browser, and runtime evidence separately in the final checklist.

**Verify:**

```powershell
git status --short
git log --oneline -5
git remote -v
npm run verify
npm run smoke:production -- --base-url $env:BUILDMATES_BASE_URL
```

Then manually verify the repository URL, production URL, plugin connection, mobile/desktop interaction, independent user identities, and rollback instructions.

**Done when:** The complete Buildmates product works in production, GitHub and release documentation match the deployed reality, and no required feature depends on test-only controls.

## Visual design boundary after Task 14

Task 14 deliberately completes the product with a clean neutral UI. Final landing-page art direction, brand identity, animations, custom-profile aesthetic exploration, globe/graph styling, decorative room/Circle direction, and polished marketing sections require a separate user-approved UI design spec after the functional production gate. That later work must reuse the stable routes, component APIs, state handling, SurfaceSpec contract, and accessibility behavior established here rather than changing product semantics.

## Parallelization map

After Tasks 1–3 establish contracts, the primary thread may run these bounded lanes:

- Lane A: Task 4 SurfaceSpec and Design Policy.
- Lane B: Task 5 MCP/plugin contract.
- Lane C: Task 8 deterministic matching and reciprocal state machine.

After their contracts merge:

- Lane A continues Task 7 generative profile governance. Task 11 is locked until Tasks 1–10 and Task 12 pass the production core-product gate.
- Lane B continues Tasks 6 and 9 onboarding/automation.
- Lane C continues Task 10 Connections, rooms, and intro memory.
- A UI lane takes Task 12 as soon as Tasks 1–10 provide real domain data and actions; its production gate precedes every Task 11 expansion.

Task 13 is an independent adversarial review plus primary-thread fixes. Task 14 begins only after the complete product passes production verification.

## Final acceptance sequence

1. Fresh install and onboarding with no connected apps.
2. Onboarding with calendar plus at least one project/document app visible.
3. Work Signal review, edit, privacy choice, revoke, and expiry.
4. Networking Pulse preferences, expiry, quiet hours, snooze, budget, exclusions, and cluster diversity.
5. Profile generation, optional statistics, shareable links, phone preview, publication, revision conflict, and rollback.
6. Project create/edit/publish/archive/delete/transfer, collaborator permissions, visibility, matching permission, history, and public metadata.
7. Sparse-network invitation, anti-abuse, follow, watch, indexability, unfurl, and honest no-match flows.
8. Deterministic mutual-relevance fixture report.
9. All four Manual/Full Autopilot combinations with independent evaluations.
10. One duplicate/racing automation attempt that creates only one Connection and room.
11. Connection notes, mute/end/reconnect, renewed relevance, member-only chat, retry, long content, block, and leave.
12. Immediate in-app events plus scheduled automation/digest fallbacks.
13. Structured intro feedback and consented upgrade proposal.
14. Shared room redesign requiring both approvals and private personal view.
15. Cohort and Circle lifecycle, role transfer, edge consent, member proposal, vote/admin publish, and metric opt-out.
16. Public discovery, cohort, graph, and coarse-location globe with accessible alternatives.
17. Report/moderation/appeal, shared-context redaction, cross-group block behavior, export, account deletion, generated-surface attacks, and authorization matrix.
18. Production phone/desktop smoke, GitHub release, plugin connection, and runtime verification.
