# Idempotency recovery

Use the authenticated Site operator console at `/operator/idempotency-recovery`. It operates on the canonical ChatGPT Sites D1 binding returned by `getPlatformBindings()`. There is intentionally no Wrangler or local-database recovery command: those paths cannot prove they are authenticated to the Site's canonical production database.

Access requires the signed-in Site identity to map to an active `users` row with `operator_role='admin'`. The mutation also requires a same-origin browser request. The server derives the operator ID from the authenticated Site identity; the form cannot supply it.

## Before changing a row

All of these must be true:

1. The exact `idempotency_keys.id` and request hash are known.
2. The original runner is definitely stopped. Wall-clock expiry or age alone is insufficient.
3. The canonical effect tables were inspected for the recorded actor and operation.
4. The outcome is unambiguous: either no effect occurred, or one supported canonical effect completed fully. Grouped ChatGPT/Codex actions have no safe operator disposition and require manual canonical investigation.
5. No partial or uncertain external side effect exists. Stop and investigate if it does.

The inspection view exposes metadata only. It never exposes raw connector input or a stored response body.

## Recovery dispositions

- `no_effect` changes the exact still-`processing` row to `failed`, allowing a normal retry when the operation has a safe operator recovery policy.
- `completed_effect` changes it to `complete` only when the selected effect kind is supported and the canonical effect ID belongs to the idempotency row's recorded actor. Unsupported, missing, or cross-actor effects fail closed.
- `perform_buildmates_action`, `perform_buildmates_project_action`, `perform_buildmates_relationship_action`, and `perform_buildmates_circle_action` are manual-only. The console hides both dispositions for these grouped operations and leaves the lease processing until a durable canonical receipt or a separately reviewed repair exists.

The database mutation compares the exact row, actor, operation, request hash, current `processing` status, active administrator, and canonical effect predicate in one conditional update. The same D1 batch writes an `idempotency.operator_recovery` audit event attributed to the authenticated administrator. A concurrent or repeated attempt does not create a second audit event.

## Deployment proof

Local Miniflare tests prove authorization predicates, effect ownership, compare-and-set behavior, and audit atomicity. Live owner-database proof remains pending until the public Site is deployed and an owner can test the operator route with a real administrator account. Do not describe production recovery as verified before that check is recorded.
