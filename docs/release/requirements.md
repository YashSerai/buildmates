# Production Release Requirements

Buildmates is releasable only when:

- every visible control works or is absent;
- migrations, authorization, reciprocal matching, SurfaceSpec, messaging, lifecycle, and moderation tests pass;
- lint, typecheck, unit, integration, contract, security, end-to-end, and production builds pass;
- web and MCP production surfaces are deployed and smoke-tested;
- plugin onboarding is exercised from a clean session where account access permits;
- desktop and phone browser states are inspected, including loading, empty, error, permission, long-content, and network-failure cases;
- source-control, deployment, browser, and runtime evidence are recorded separately;
- the deployment, migration, data, and generated-surface procedures in `docs/release/rollback.md` are current;
- any human-only canonical-account authentication is isolated, and a separate second identity is required only for live two-user validation after automated multi-identity checks pass.

## Evidence by truth layer

- Source control: branch, commit SHA, clean/expected worktree state, remote URL, pushed release tag, and the exact source revision selected for deployment.
- Deployment: selected host/topology, immutable version or deployment identifier, migration package, deployment status, rollback target, and public/private URL as applicable.
- Browser: signed-out and signed-in route checks at desktop and phone sizes, visible control behavior, keyboard/focus, console/network errors, and loading/empty/error/permission/long-content states.
- Production runtime: health/smoke results against the deployed URL, D1/R2 or selected-store reads/writes, MCP initialize/tool call, authorization denial, message persistence, and any isolated external-account validation.
