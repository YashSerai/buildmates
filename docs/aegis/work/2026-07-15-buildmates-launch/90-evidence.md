# Buildmates Launch Evidence

## Baseline

- 2026-07-15: local repository exists on unborn `main`; all starter and planning files are untracked.
- 2026-07-15: GitHub CLI authenticated as `YashSerai` with repository and workflow scopes.
- 2026-07-15: runtime versions observed: Node 24.8.0, npm 11.6.0, Git 2.37.3.windows.1.
- 2026-07-15: Sites vinext starter contains Next 16.2.6, React 19.2.6, vinext 0.0.50, D1/Drizzle scaffolding, and `.openai/hosting.json` with unbound D1/R2.

Further evidence is appended per task. This file separates observed source-control, build, browser, deployment, and runtime claims.

## Task 1

- Source control: baseline commit `4c92166` pushed to private `https://github.com/YashSerai/buildmates`; branch `launch/buildmates` created in ignored project-local worktree.
- Baseline failure: original `npm test` failed because `WRANGLER_LOG_PATH=...` used Unix-only syntax on Windows. This was the planned compatibility defect.
- Repair: root npm workspaces plus `apps/web`, `apps/mcp`, and five shared packages; web scripts now use `cross-env`.
- Verification: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run build` exit 0 on 2026-07-15.
- Test-runner isolation: the first workspace `npm test` loaded the parent checkout's Vite config because the worktree is nested. An explicit root `vitest.config.ts` now prevents config traversal; fresh `npm test` exits 0 with the currently empty Task 1 suites.
- Dependency audit: production audit currently reports two moderate findings through Next's nested PostCSS dependency; no high or critical production dependency finding. This remains open for release dependency review rather than hidden.
- Review: Task 1 spec-compliance review approved after environment-template and boundary-document fixes; code-quality review approved after nested-ignore, real-test, and runtime-neutral TypeScript fixes.

## Task 2

- Local storage: D1 migrations 0000-0002 apply with no pending migration; real Miniflare D1 tests cover concurrent one-use identity linking, identity convergence, PKCE, authorization-code replay, refresh rotation and family-wide reuse revocation, audience validation, signed one-time handoff, and cross-user private-record denial.
- MCP/OAuth: the external adapter exposes executable OAuth discovery/authorize/token/revoke endpoints and SDK web-standard Streamable HTTP. The protected-resource URL advertised by `WWW-Authenticate` is followed successfully in tests.
- Local runtime: no-argument PowerShell 5.1 smoke starts and stops vinext on a free port and verifies page 200, protected D1/R2 401, truthful Sites MCP 501, and disabled external data route 404.
- Primary verification on 2026-07-15: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, smoke, and `git diff --check` all exit 0; integration tests pass 11/11.
- Review: independent Task 2 spec review approved after OAuth, handoff, atomicity, D1, and discovery repairs; independent security-quality review approved after refresh-family replay revocation and direct MCP SDK dependency repairs.
- Production truth: live Sites reachability, SIWC identity, provisioned D1/R2, and the selected external MCP deployment remain unverified until the exact pushed commit is deployed.
