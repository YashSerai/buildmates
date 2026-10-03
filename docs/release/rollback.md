# Buildmates rollback runbook

Use this runbook only after recording the incident, affected surface, current deployment/version, and last known-good target. Keep web, MCP, data, and generated-surface rollback decisions separate.

## Web deployment

1. Select a previously saved ChatGPT Sites version whose source commit and migration package are recorded in the release evidence.
2. Redeploy that immutable saved version; do not rebuild an old commit with current dependencies or pair an archive with a different commit.
3. Preserve the current Site access policy unless access itself caused the incident. A code rollback must not silently make a private Site public or remove an allowed user.
4. Verify the landing page, `/api/ready`, security headers, `/home` authentication boundary, robots, and manifest against the returned production URL.

Resolve the last compatible saved version from the live Sites inventory immediately before release and record it in the release evidence. Historical versions named in older evidence are not current rollback authority.

## MCP Worker

1. Select the last known-good immutable Cloudflare Worker version from release evidence.
2. Roll the Worker back without changing its OAuth issuer, resource URL, registered redirect URI, D1 binding, or signing-key configuration.
3. Verify authorization-server metadata, protected-resource metadata, unauthenticated `/mcp` rejection, then one complete PKCE/link/tool path when an authenticated test identity is available.

Resolve and record the current immutable Worker version immediately before release. Do not use an old version identifier from a previous release without checking compatibility with the current database and OAuth configuration.

## D1 migrations and data

Buildmates migrations are forward-only. Do not delete tables, edit migration history, or run a down migration during an incident.

1. Before deploying a schema-changing release, record the exact migration range and create or confirm the provider recovery point/export required by the release checklist.
2. If application code is incompatible, first redeploy the last compatible web or MCP version when the additive schema still supports it.
3. Prefer a reviewed forward-fix migration for schema defects.
4. Restore D1 from a provider recovery point only when data corruption or destructive migration damage requires it, after explicitly approving the recovery timestamp and expected data loss window.
5. Re-run readiness plus the smallest affected authorization, write/read, and concurrency checks after recovery.

Web product data and MCP OAuth data live in separate D1 databases. Never restore one as a substitute for the other.

## Generated profiles, rooms, and Circles

Generated surfaces use revision rollback rather than database restoration.

- Profile: the owner selects a historical shared revision and chooses **Use as rollback preview**, reviews the new preview, then publishes it.
- Room: either active member may create the rollback preview; every active member must approve before publication.
- Circle: rollback follows the Circle's current governance—admin publication or the configured member vote.
- MCP: `rollback_surface` requires the surface ID, historical shared revision ID, current expected surface version, `confirmation: "confirmed"`, and a new idempotency key.
- A personal view can never become a rollback target. Rollback creates a new audited revision; it does not mutate or erase history.

If an asset was physically deleted by account deletion, it is intentionally unrecoverable and must not be reconstructed from logs or another user's copy.

## Closeout

Record the restored deployment/version, migration state, access-policy revision, smoke results, remaining data-loss window, and whether authenticated production or two-user checks remain pending. Do not call the incident closed from health checks alone when identity, authorization, or shared-room behavior was affected.
