# Buildmates Launch Goal

Status: ready to activate  
Activation phrase: `go`

## Terminal outcome

Implement the complete approved Buildmates product, push it to GitHub, deploy its production web and MCP surfaces, connect the plugin, and verify the launch through automated tests plus real browser/computer checks. Do not stop at architecture probes, partial verticals, locally passing code, or a demo deployment.

The launch includes the complete neutral functional UI and every feature in the canonical product specification. Final bespoke brand direction, landing-page art direction, signature animation, and advanced profile/globe aesthetics remain the next user-approved phase after the neutral product is production-ready.

## Execution contract

When the user says `go`:

1. Execute the complete one-shot plan from repository setup through production release.
2. Use bounded subagents heavily for implementation, security, review, and QA while the primary thread owns shared contracts, integration, Git, and release truth.
3. Use browser/computer access to complete deployments, inspect desktop and phone layouts, exercise real controls, and verify production behavior.
4. Treat capability checks as implementation evidence, not user handoff points.
5. When a preferred capability fails, diagnose it and select the documented fallback without asking the user to make an ordinary architecture choice.
6. Continue through failing tests, integration defects, deployment defects, and review findings until they are repaired or reduced to an irreducible external action.
7. Keep source-control, deployment, browser, and production-runtime truth separate until each is verified.

## Automatic fallback authority

- Prefer ChatGPT Sites for `apps/web`; if its public/authenticated runtime cannot support the production contract, deploy the same web contracts through the prepared Cloudflare/Vercel adapter rather than stopping with a partial product.
- Co-deploy MCP only if verified; otherwise deploy `apps/mcp` independently without changing tools or domain behavior.
- Prefer Sign in with ChatGPT when it supplies a stable public-user identity; otherwise activate the prepared GitHub OAuth adapter.
- Prefer the Codex/Calendar handoff when available; otherwise ship copy-prompt, in-product time proposals, and ICS.
- Prefer bounded polling for launch chat; do not block launch on realtime sockets.
- Do not add backend model inference or embeddings merely to bypass deterministic matching work.

## Human-only interruption boundary

Do not pause for internal milestones, uncertainty that can be investigated, ordinary implementation decisions, failing tests, or supported fallbacks. Ask the user only when progress requires an action that cannot be performed through the available workspace/browser session, such as:

- signing into or approving a genuinely separate second account;
- completing CAPTCHA, 2FA, reauthentication, or an owner-only consent screen;
- supplying a missing credential, billing authorization, domain control, or account permission that no available session possesses.

If live second-account access is unavailable, complete automated multi-identity authorization and end-to-end coverage first, then isolate the one remaining live validation instead of stopping the rest of the build.

## Completion evidence

Completion requires:

- all approved feature flows implemented with no dead controls or fake completeness;
- migrations, authorization, privacy, matching, messaging, SurfaceSpec, moderation, export, and deletion tests passing;
- lint, type checks, unit, integration, contract, security, end-to-end, and production builds passing;
- GitHub repository, commits, release documentation, and release tag matching the shipped code;
- production web and MCP endpoints deployed and smoke-tested;
- plugin installation/onboarding exercised from a clean session where account access permits;
- desktop and phone browser checks covering loading, empty, error, long-content, keyboard, focus, overflow, and network-failure states;
- source-control, deployment, browser, and runtime evidence recorded separately;
- any irreducible human-only validation explicitly isolated, with every non-human dependency already complete.

Canonical scope and implementation details remain in `BUILD_INDEX.md` and `docs/aegis/`.
