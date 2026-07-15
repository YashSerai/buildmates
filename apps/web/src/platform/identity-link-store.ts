export type IdentityLinkCompletion = { linked: true; userId: string } | { linked: false; reason: "invalid_or_expired" | "conflict" };

export type IdentityLinkStore = {
  consume(input: { codeHash: string; workspaceScope: string; mcpSubject: string; now: number }): Promise<IdentityLinkCompletion>;
};

type D1BatchDatabase = D1Database;

export function createD1IdentityLinkStore(DB: D1BatchDatabase): IdentityLinkStore {
  return {
    async consume({ codeHash, workspaceScope, mcpSubject, now }) {
      const candidate = await DB.prepare(
        "SELECT id, user_id AS userId FROM identity_link_codes WHERE code_hash = ? AND workspace_scope = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < max_attempts LIMIT 1",
      ).bind(codeHash, workspaceScope, now).first<{ id: string; userId: string }>();
      if (!candidate) return { linked: false, reason: "invalid_or_expired" };

      const principalId = crypto.randomUUID();
      try {
        const results = await DB.batch([
          DB.prepare(
            "UPDATE identity_link_codes SET consumed_at = ?, consumed_by_principal_id = ?, attempt_count = attempt_count + 1 WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < max_attempts",
          ).bind(now, principalId, candidate.id, now),
          DB.prepare(
            "INSERT INTO identity_principals (id, channel, issuer, subject, workspace_scope, created_at, revoked_at) SELECT ?, 'mcp', 'buildmates_mcp', ?, workspace_scope, ?, NULL FROM identity_link_codes WHERE id = ? AND consumed_by_principal_id = ?",
          ).bind(principalId, mcpSubject, now, candidate.id, principalId),
          DB.prepare(
            "INSERT INTO identity_links (id, user_id, principal_id, provider_channel, provider_issuer, provider_subject, workspace_scope, linked_at, revoked_at) SELECT ?, user_id, ?, 'mcp', 'buildmates_mcp', ?, workspace_scope, ?, NULL FROM identity_link_codes WHERE id = ? AND consumed_by_principal_id = ?",
          ).bind(crypto.randomUUID(), principalId, mcpSubject, now, candidate.id, principalId),
        ]);
        const changed = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
        return changed === 1 ? { linked: true, userId: candidate.userId } : { linked: false, reason: "conflict" };
      } catch {
        // D1 batch is transactional: a uniqueness or insert failure rolls the CAS back.
        return { linked: false, reason: "conflict" };
      }
    },
  };
}

export async function completeIdentityLink(
  store: IdentityLinkStore,
  input: { code: string; workspaceScope: string; mcpSubject: string; now?: number },
): Promise<IdentityLinkCompletion> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(code) || input.workspaceScope.length > 128) {
    return { linked: false, reason: "invalid_or_expired" };
  }
  return store.consume({
    codeHash: await sha256(code),
    workspaceScope: input.workspaceScope,
    mcpSubject: input.mcpSubject,
    now: input.now ?? Date.now(),
  });
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
