# Operations

## Account deletion recovery

The deletion request immediately revokes access, removes private database content, redacts shared content, and marks the account as `deleting`. Surface objects are purged from R2 and the D1 fallback store in batches of at most 100 objects. A normal account finishes in the request. A historical account with more objects, or an R2 failure, returns a queued deletion job and stays unavailable until recovery completes.

An active admin can inspect pending jobs with:

```text
GET /api/operator/deletion-recovery
```

To process one batch, send the job ID in a same-origin request:

```text
POST /api/operator/deletion-recovery
{"jobId":"deletion_<uuid>"}
```

Repeat the POST for a job while it returns `status: "deleting"`. Stop and investigate an error or an unchanged job timestamp. The route requires an active admin session and a same-origin mutation request. It does not accept a user supplied actor or an arbitrary account ID.

Before treating a job as complete, verify all three conditions:

```sql
SELECT job.status, user.status AS user_status
FROM deletion_jobs job
JOIN users user ON user.id = job.user_id
WHERE job.id = ?;

SELECT COUNT(*) AS pending_assets
FROM surface_assets
WHERE owner_user_id = ?
  AND deleted_at IS NOT NULL
  AND object_purged_at IS NULL;

SELECT COUNT(*) AS fallback_blobs
FROM surface_asset_blobs blob
JOIN surface_assets asset ON asset.id = blob.asset_id
WHERE asset.owner_user_id = ?;
```

Completion requires `deletion_jobs.status = 'complete'`, `users.status = 'deleted'`, zero pending assets, and zero fallback blobs. R2 deletion is confirmed by the batch response and can be retried because object deletion is idempotent.

## Uncertain grouped writes

If a grouped ChatGPT or Codex write leaves an idempotency row in `processing`, do not retry the side effect or mark it complete from the chat response. Inspect the stored request hash, operation, and canonical effect. If the effect cannot be proved from the authoritative database, leave the row unresolved and investigate it manually. Recovery must fail closed when the effect is unknown.
