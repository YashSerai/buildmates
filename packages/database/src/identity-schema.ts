import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
};

export const identityPrincipals = sqliteTable(
  "identity_principals",
  {
    id: text("id").primaryKey(),
    channel: text("channel", { enum: ["web", "mcp"] }).notNull(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    workspaceScope: text("workspace_scope").notNull().default("global"),
    ...timestamps,
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("identity_principal_subject_scope_unique").on(
      table.channel,
      table.issuer,
      table.subject,
      table.workspaceScope,
    ),
  ],
);

export const identityLinks = sqliteTable(
  "identity_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    principalId: text("principal_id")
      .notNull()
      .references(() => identityPrincipals.id),
    providerChannel: text("provider_channel", { enum: ["web", "mcp"] }).notNull(),
    providerIssuer: text("provider_issuer").notNull(),
    providerSubject: text("provider_subject").notNull(),
    workspaceScope: text("workspace_scope").notNull().default("global"),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("identity_link_subject_scope_unique").on(
      table.providerChannel,
      table.providerIssuer,
      table.providerSubject,
      table.workspaceScope,
    ),
    uniqueIndex("identity_link_principal_unique").on(table.principalId),
  ],
);

export const identityLinkCodes = sqliteTable(
  "identity_link_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    workspaceScope: text("workspace_scope").notNull().default("global"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    consumedByPrincipalId: text("consumed_by_principal_id"),
    ...timestamps,
  },
  (table) => [uniqueIndex("identity_link_code_hash_unique").on(table.codeHash)],
);

export const oauthTokens = sqliteTable(
  "oauth_tokens",
  {
    id: text("id").primaryKey(),
    principalId: text("principal_id")
      .notNull()
      .references(() => identityPrincipals.id),
    tokenHash: text("token_hash").notNull(),
    tokenKind: text("token_kind", { enum: ["authorization_code", "access", "refresh"] }).notNull(),
    clientId: text("client_id").notNull(),
    familyId: text("family_id").notNull(),
    audience: text("audience").notNull(),
    scopes: text("scopes").notNull(),
    redirectUri: text("redirect_uri"),
    pkceChallenge: text("pkce_challenge"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    consumedById: text("consumed_by_id"),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    rotatedFromId: text("rotated_from_id"),
    ...timestamps,
  },
  (table) => [uniqueIndex("oauth_token_hash_unique").on(table.tokenHash)],
);

export const platformCapabilityChecks = sqliteTable("platform_capability_checks", {
  id: text("id").primaryKey(),
  actorKey: text("actor_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const mcpRateLimits = sqliteTable("mcp_rate_limits", {
  key: text("key").primaryKey(),
  attemptCount: integer("attempt_count").notNull(),
  windowExpiresAt: integer("window_expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const oauthAuthorizationHandoffs = sqliteTable("oauth_authorization_handoffs", {
  stateHash: text("state_hash").primaryKey(),
  requestUri: text("request_uri").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  consumedByJti: text("consumed_by_jti"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const privateCapabilityRecords = sqliteTable("private_capability_records", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const assertionReplays = sqliteTable(
  "assertion_replays",
  {
    jti: text("jti").primaryKey(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    action: text("action").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("assertion_replay_issuer_jti_unique").on(table.issuer, table.jti)],
);
