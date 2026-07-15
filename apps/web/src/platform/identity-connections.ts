export type IdentityConnectionStatus = {
  connected: boolean;
  connectionCount: number;
  linkedAt: string | null;
};

type LinkRow = { connectionCount: number; linkedAt: number | null };

export async function getIdentityConnectionStatus(
  DB: D1Database,
  userId: string,
  workspaceScope: string,
): Promise<IdentityConnectionStatus> {
  const row = await DB.prepare(
    "SELECT COUNT(*) AS connectionCount, MAX(linked_at) AS linkedAt FROM identity_links WHERE user_id = ? AND provider_channel = 'mcp' AND provider_issuer = 'buildmates_mcp' AND workspace_scope = ? AND revoked_at IS NULL",
  ).bind(userId, workspaceScope).first<LinkRow>();
  const connectionCount = Number(row?.connectionCount ?? 0);
  const linkedAt = row?.linkedAt == null ? null : new Date(Number(row.linkedAt)).toISOString();
  return { connected: connectionCount > 0, connectionCount, linkedAt };
}

export async function revokeIdentityConnections(
  DB: D1Database,
  userId: string,
  workspaceScope: string,
  now: number,
): Promise<boolean> {
  const results = await DB.batch([
    DB.prepare(
      "UPDATE identity_principals SET revoked_at = COALESCE(revoked_at, ?) WHERE id IN (SELECT principal_id FROM identity_links WHERE user_id = ? AND provider_channel = 'mcp' AND provider_issuer = 'buildmates_mcp' AND workspace_scope = ? AND revoked_at IS NULL)",
    ).bind(now, userId, workspaceScope),
    DB.prepare(
      "UPDATE identity_links SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ? AND provider_channel = 'mcp' AND provider_issuer = 'buildmates_mcp' AND workspace_scope = ? AND revoked_at IS NULL",
    ).bind(now, userId, workspaceScope),
    DB.prepare(
      "UPDATE identity_link_codes SET expires_at = ? WHERE user_id = ? AND workspace_scope = ? AND consumed_at IS NULL AND expires_at > ?",
    ).bind(now, userId, workspaceScope, now),
  ]);
  return Number((results[1].meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}
