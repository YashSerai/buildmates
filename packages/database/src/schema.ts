import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const created = () => integer("created_at", { mode: "timestamp_ms" }).notNull();
const updated = () => integer("updated_at", { mode: "timestamp_ms" }).notNull();
const userRef = (name: string) =>
  text(name)
    .notNull()
    .references(() => users.id);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  status: text("status", {
    enum: ["active", "restricted", "suspended", "deleting", "deleted"],
  })
    .notNull()
    .default("active"),
  operatorRole: text("operator_role", { enum: ["none", "moderator", "admin"] })
    .notNull()
    .default("none"),
  createdAt: created(),
  updatedAt: updated(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const handles = sqliteTable(
  "handles",
  {
    userId: userRef("user_id").primaryKey(),
    handle: text("handle").notNull(),
    normalizedHandle: text("normalized_handle").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("handles_normalized_unique").on(t.normalizedHandle)],
);

export const connectedAppPreferences = sqliteTable(
  "connected_app_preferences",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    appId: text("app_id").notNull(),
    displayName: text("display_name").notNull(),
    category: text("category").notNull(),
    accessMode: text("access_mode", {
      enum: ["never", "ask_each_time", "allow_approved_work_signals", "actions_only"],
    })
      .notNull()
      .default("ask_each_time"),
    lastReviewedAt: integer("last_reviewed_at", {
      mode: "timestamp_ms",
    }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("connected_app_user_app_unique").on(t.userId, t.appId),
    check(
      "connected_app_access_mode_valid",
      sql`${t.accessMode} in ('never','ask_each_time','allow_approved_work_signals','actions_only')`,
    ),
  ],
);

export const taxonomyVersions = sqliteTable(
  "taxonomy_versions",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "active", "retired"] })
      .notNull()
      .default("draft"),
    createdAt: created(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("taxonomy_version_unique").on(t.version)],
);
export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    uniqueIndex("topic_version_slug_unique").on(t.taxonomyVersionId, t.slug),
  ],
);
export const topicAliases = sqliteTable(
  "topic_aliases",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    normalizedAlias: text("normalized_alias").notNull(),
  },
  (t) => [uniqueIndex("topic_alias_unique").on(t.topicId, t.normalizedAlias)],
);
export const topicRelationships = sqliteTable(
  "topic_relationships",
  {
    fromTopicId: text("from_topic_id")
      .notNull()
      .references(() => topics.id),
    toTopicId: text("to_topic_id")
      .notNull()
      .references(() => topics.id),
    kind: text("kind", { enum: ["related", "broader", "narrower"] }).notNull(),
    weightBasisPoints: integer("weight_basis_points").notNull().default(5000),
  },
  (t) => [
    primaryKey({ columns: [t.fromTopicId, t.toTopicId, t.kind] }),
    check(
      "topic_relationship_no_self",
      sql`${t.fromTopicId} <> ${t.toTopicId}`,
    ),
  ],
);
export const tools = sqliteTable(
  "tools",
  {
    id: text("id").primaryKey(),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    uniqueIndex("tool_version_slug_unique").on(t.taxonomyVersionId, t.slug),
  ],
);
export const domains = sqliteTable(
  "domains",
  {
    id: text("id").primaryKey(),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    uniqueIndex("domain_version_slug_unique").on(t.taxonomyVersionId, t.slug),
  ],
);
export const stages = sqliteTable(
  "stages",
  {
    id: text("id").primaryKey(),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [
    uniqueIndex("stage_version_slug_unique").on(t.taxonomyVersionId, t.slug),
  ],
);
export const collaborationIntents = sqliteTable(
  "collaboration_intents",
  {
    id: text("id").primaryKey(),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    uniqueIndex("intent_version_slug_unique").on(t.taxonomyVersionId, t.slug),
  ],
);

export const workSignals = sqliteTable(
  "work_signals",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    sourceAppId: text("source_app_id"),
    sourceApprovalId: text("source_approval_id"),
    taxonomyVersionId: text("taxonomy_version_id")
      .notNull()
      .references(() => taxonomyVersions.id),
    freeTextSummary: text("free_text_summary").notNull(),
    canonicalTopicIdsJson: text("canonical_topic_ids_json")
      .notNull()
      .default("[]"),
    canonicalToolIdsJson: text("canonical_tool_ids_json")
      .notNull()
      .default("[]"),
    canonicalDomainIdsJson: text("canonical_domain_ids_json")
      .notNull()
      .default("[]"),
    canonicalStageIdsJson: text("canonical_stage_ids_json")
      .notNull()
      .default("[]"),
    canonicalCollaborationIntentIdsJson: text("canonical_collaboration_intent_ids_json")
      .notNull()
      .default("[]"),
    audience: text("audience", {
      enum: [
        "public",
        "signed_in",
        "suggested_connections",
        "mutual_connections",
        "private",
      ],
    })
      .notNull()
      .default("private"),
    cohortScopeId: text("cohort_scope_id").references(() => cohorts.id),
    allowMatching: integer("allow_matching", { mode: "boolean" })
      .notNull()
      .default(false),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("work_signal_user_expiry_idx").on(t.userId, t.expiresAt),
    uniqueIndex("work_signal_source_approval_unique").on(t.sourceApprovalId),
    check(
      "work_signal_audience_valid",
      sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`,
    ),
    check(
      "work_signal_allow_matching_boolean",
      sql`${t.allowMatching} in (0,1)`,
    ),
  ],
);

export const builderMatchIndex = sqliteTable("builder_match_index", {
  userId: userRef("user_id").primaryKey(),
  version: integer("version").notNull(),
  taxonomyVersionId: text("taxonomy_version_id")
    .notNull()
    .references(() => taxonomyVersions.id),
  topicsJson: text("topics_json").notNull().default("[]"),
  toolsJson: text("tools_json").notNull().default("[]"),
  domainsJson: text("domains_json").notNull().default("[]"),
  stagesJson: text("stages_json").notNull().default("[]"),
  intentsJson: text("intents_json").notNull().default("[]"),
  coarseLocation: text("coarse_location"),
  timezone: text("timezone"),
  updatedAt: updated(),
}, (t) => [index("builder_match_index_taxonomy_version_idx").on(t.taxonomyVersionId, t.version)]);

export const pairScores = sqliteTable(
  "pair_scores",
  {
    id: text("id").primaryKey(),
    userAId: userRef("user_a_id"),
    userBId: userRef("user_b_id"),
    indexVersionA: integer("index_version_a").notNull(),
    indexVersionB: integer("index_version_b").notNull(),
    taxonomyVersion: integer("taxonomy_version").notNull(),
    weightVersion: integer("weight_version").notNull(),
    componentsJson: text("components_json").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    audienceDecisionsJson: text("audience_decisions_json")
      .notNull()
      .default("[]"),
    totalBasisPoints: integer("total_basis_points").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("pair_score_versions_unique").on(
      t.userAId,
      t.userBId,
      t.indexVersionA,
      t.indexVersionB,
      t.weightVersion,
    ),
    index("pair_scores_user_a_expiry_score_idx").on(t.userAId, t.expiresAt, t.totalBasisPoints),
    index("pair_scores_user_b_expiry_score_idx").on(t.userBId, t.expiresAt, t.totalBasisPoints),
    check("pair_score_canonical_pair", sql`${t.userAId} < ${t.userBId}`),
    check("pair_score_range", sql`${t.totalBasisPoints} between 0 and 10000`),
  ],
);

export const networkingPulses = sqliteTable(
  "networking_pulses",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    intentSummary: text("intent_summary").notNull(),
    similarAdjacent: integer("similar_adjacent").notNull().default(50),
    localGlobal: integer("local_global").notNull().default(50),
    serendipity: integer("serendipity").notNull().default(25),
    collaborationIntentIdsJson: text("collaboration_intent_ids_json")
      .notNull()
      .default("[]"),
    controlsJson: text("controls_json").notNull().default("{}"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: created(),
  },
  (t) => [index("networking_pulse_user_expiry_idx").on(t.userId, t.expiresAt)],
);
export const introductionBudgets = sqliteTable(
  "introduction_budgets",
  {
    userId: userRef("user_id").primaryKey(),
    maximumPerWeek: integer("maximum_per_week").notNull().default(3),
    usedThisWeek: integer("used_this_week").notNull().default(0),
    weekStartedAt: integer("week_started_at", {
      mode: "timestamp_ms",
    }).notNull(),
  },
  (t) => [
    check(
      "intro_budget_nonnegative",
      sql`${t.maximumPerWeek} >= 0 and ${t.usedThisWeek} >= 0`,
    ),
  ],
);
export const quietHours = sqliteTable(
  "quiet_hours",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    timezone: text("timezone").notNull(),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    uniqueIndex("quiet_hours_slot_unique").on(
      t.userId,
      t.weekday,
      t.startMinute,
      t.endMinute,
    ),
    check("quiet_hours_weekday", sql`${t.weekday} between 0 and 6`),
  ],
);
export const matchingSnoozes = sqliteTable("matching_snoozes", {
  id: text("id").primaryKey(),
  userId: userRef("user_id"),
  reason: text("reason"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: created(),
});
export const matchingExclusions = sqliteTable(
  "matching_exclusions",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    kind: text("kind", {
      enum: ["user", "company", "industry", "topic", "cluster"],
    }).notNull(),
    normalizedValue: text("normalized_value").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("matching_exclusion_unique").on(
      t.userId,
      t.kind,
      t.normalizedValue,
    ),
  ],
);
export const watches = sqliteTable(
  "watches",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    kind: text("kind", {
      enum: ["topic", "project", "cohort", "relevant_builder"],
    }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: created(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("watch_user_target_unique").on(t.userId, t.kind, t.targetId),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    displayName: text("display_name").notNull(),
    summary: text("summary").notNull(),
    projectOrInterest: text("project_or_interest").notNull().default(""),
    portfolioLinksJson: text("portfolio_links_json").notNull().default("[]"),
    audience: text("audience", {
      enum: [
        "public",
        "signed_in",
        "suggested_connections",
        "mutual_connections",
        "private",
      ],
    })
      .notNull()
      .default("private"),
    cohortScopeId: text("cohort_scope_id").references(() => cohorts.id),
    allowMatching: integer("allow_matching", { mode: "boolean" })
      .notNull()
      .default(false),
    acceptanceMode: text("acceptance_mode", {
      enum: ["manual", "full_autopilot"],
    })
      .notNull()
      .default("manual"),
    indexable: integer("indexable", { mode: "boolean" })
      .notNull()
      .default(false),
    coarseLocation: text("coarse_location"),
    locationMapOptIn: integer("location_map_opt_in", { mode: "boolean" })
      .notNull()
      .default(false),
    timezone: text("timezone"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("profile_user_unique").on(t.userId),
    check(
      "profile_audience_valid",
      sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`,
    ),
    check("profile_allow_matching_boolean", sql`${t.allowMatching} in (0,1)`),
    check(
      "profile_acceptance_mode_valid",
      sql`${t.acceptanceMode} in ('manual','full_autopilot')`,
    ),
  ],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: userRef("owner_user_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    audience: text("audience", {
      enum: [
        "public",
        "signed_in",
        "suggested_connections",
        "mutual_connections",
        "private",
      ],
    })
      .notNull()
      .default("private"),
    cohortScopeId: text("cohort_scope_id").references(() => cohorts.id),
    allowMatching: integer("allow_matching", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: ["draft", "active", "archived", "deleted"] })
      .notNull()
      .default("draft"),
    stage: text("stage").notNull().default("exploring"),
    indexable: integer("indexable", { mode: "boolean" }).notNull().default(false),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("project_slug_unique").on(t.slug),
    check(
      "project_audience_valid",
      sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`,
    ),
    check("project_allow_matching_boolean", sql`${t.allowMatching} in (0,1)`),
  ],
);

export const profileFields = sqliteTable(
  "profile_fields",
  {
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    valueJson: text("value_json").notNull(),
    audience: text("audience", { enum: ["public", "signed_in", "suggested_connections", "mutual_connections", "private"] }).notNull().default("private"),
    cohortScopeId: text("cohort_scope_id").references(() => cohorts.id),
    allowMatching: integer("allow_matching", { mode: "boolean" }).notNull().default(false),
    sourceStatus: text("source_status", { enum: ["generated", "confirmed"] }).notNull().default("confirmed"),
    provenance: text("provenance", { enum: ["self_reported", "codex_summary", "connected_app", "system"] }).notNull().default("self_reported"),
    updatedAt: updated(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.fieldKey] }), index("profile_fields_audience_idx").on(t.profileId, t.audience), check("profile_field_audience_valid", sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`), check("profile_field_matching_boolean", sql`${t.allowMatching} in (0,1)`), check("profile_field_source_valid", sql`${t.sourceStatus} in ('generated','confirmed')`), check("profile_field_provenance_valid", sql`${t.provenance} in ('self_reported','codex_summary','connected_app','system')`)],
);

export const profileStatistics = sqliteTable("profile_statistics", {
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  statKey: text("stat_key").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  provenance: text("provenance", { enum: ["self_reported", "connected_app", "system"] }).notNull(),
  audience: text("audience", { enum: ["public", "signed_in", "suggested_connections", "mutual_connections", "private"] }).notNull().default("private"),
  updatedAt: updated(),
}, (t) => [primaryKey({ columns: [t.profileId, t.statKey] }), check("profile_stat_audience_valid", sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`), check("profile_stat_provenance_valid", sql`${t.provenance} in ('self_reported','connected_app','system')`)]);

export const projectLinks = sqliteTable("project_links", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), label: text("label").notNull(), url: text("url").notNull(), position: integer("position").notNull().default(0), createdAt: created(),
});
export const projectMedia = sqliteTable("project_media", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), assetId: text("asset_id").notNull().references(() => surfaceAssets.id), altText: text("alt_text").notNull(), position: integer("position").notNull().default(0), createdAt: created(),
});
export const projectUpdates = sqliteTable("project_updates", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), authorUserId: userRef("author_user_id"), body: text("body").notNull(), audience: text("audience", { enum: ["public", "signed_in", "suggested_connections", "mutual_connections", "private"] }).notNull().default("public"), createdAt: created(), editedAt: integer("edited_at", { mode: "timestamp_ms" }),
}, (t) => [check("project_update_audience_valid", sql`${t.audience} in ('public','signed_in','suggested_connections','mutual_connections','private')`)]);
export const projectTaxonomyItems = sqliteTable("project_taxonomy_items", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), kind: text("kind", { enum: ["topic", "tool", "domain"] }).notNull(), taxonomyItemId: text("taxonomy_item_id").notNull(), createdAt: created(),
}, (t) => [primaryKey({ columns: [t.projectId, t.kind, t.taxonomyItemId] }), check("project_taxonomy_kind_valid", sql`${t.kind} in ('topic','tool','domain')`)]);
export const projectCollaborators = sqliteTable(
  "project_collaborators",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    userId: userRef("user_id"),
    role: text("role", { enum: ["viewer", "editor", "owner"] })
      .notNull()
      .default("viewer"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const follows = sqliteTable(
  "follows",
  {
    followerUserId: userRef("follower_user_id"),
    targetKind: text("target_kind", {
      enum: ["profile", "project", "topic", "cohort"],
    }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: created(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.followerUserId, t.targetKind, t.targetId] }),
  ],
);
export const inviteLinks = sqliteTable(
  "invite_links",
  {
    id: text("id").primaryKey(),
    creatorUserId: userRef("creator_user_id"),
    kind: text("kind", {
      enum: ["personal", "cohort_admin", "builder", "connection_card"],
    }).notNull(),
    tokenHash: text("token_hash").notNull(),
    headline: text("headline"),
    targetId: text("target_id"),
    recipientUserId: text("recipient_user_id").references(() => users.id),
    maximumUses: integer("maximum_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("invite_token_hash_unique").on(t.tokenHash),
    index("invite_recipient_active_idx").on(t.recipientUserId, t.expiresAt),
  ],
);
export const inviteRedemptions = sqliteTable(
  "invite_redemptions",
  {
    inviteId: text("invite_id")
      .notNull()
      .references(() => inviteLinks.id),
    userId: userRef("user_id"),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.inviteId, t.userId] }),
    index("invite_redemptions_user_idx").on(t.userId, t.acceptedAt),
  ],
);

export const cohorts = sqliteTable(
  "cohorts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    visibility: text("visibility", {
      enum: ["public", "request", "invite", "private"],
    })
      .notNull()
      .default("request"),
    communityCreated: integer("community_created", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status", { enum: ["active", "archived", "deleted"] })
      .notNull()
      .default("active"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("cohort_slug_unique").on(t.slug)],
);
export const cohortMemberships = sqliteTable(
  "cohort_memberships",
  {
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    userId: userRef("user_id"),
    role: text("role", { enum: ["member", "admin", "owner"] })
      .notNull()
      .default("member"),
    status: text("status", {
      enum: ["requested", "invited", "active", "declined", "removed", "left"],
    })
      .notNull()
      .default("requested"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.cohortId, t.userId] })],
);
export const cohortInvitations = sqliteTable(
  "cohort_invitations",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    inviterUserId: userRef("inviter_user_id"),
    inviteeUserId: text("invitee_user_id").references(() => users.id),
    inviteeAddressHash: text("invitee_address_hash"),
    tokenHash: text("token_hash").notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "declined", "revoked", "expired"],
    })
      .notNull()
      .default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("cohort_invitation_token_unique").on(t.tokenHash),
    uniqueIndex("cohort_invitation_pending_user_unique")
      .on(t.cohortId, t.inviteeUserId)
      .where(sql`${t.status} = 'pending'`),
    uniqueIndex("cohort_invitation_pending_address_unique")
      .on(t.cohortId, t.inviteeAddressHash)
      .where(sql`${t.status} = 'pending'`),
    check(
      "cohort_invitation_target_present",
      sql`${t.inviteeUserId} is not null or ${t.inviteeAddressHash} is not null`,
    ),
    check(
      "cohort_invitation_status_valid",
      sql`${t.status} in ('pending','accepted','declined','revoked','expired')`,
    ),
  ],
);
export const connectionCards = sqliteTable(
  "connection_cards",
  {
    id: text("id").primaryKey(),
    creatorUserId: userRef("creator_user_id"),
    projectId: text("project_id").references(() => projects.id),
    headline: text("headline").notNull(),
    topicIdsJson: text("topic_ids_json").notNull().default("[]"),
    tokenHash: text("token_hash").notNull(),
    status: text("status", { enum: ["active", "revoked", "expired"] })
      .notNull()
      .default("active"),
    maximumUses: integer("maximum_uses").notNull().default(20),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("connection_card_token_unique").on(t.tokenHash),
    check(
      "connection_card_status_valid",
      sql`${t.status} in ('active','revoked','expired')`,
    ),
    check(
      "connection_card_use_bounds",
      sql`${t.maximumUses} > 0 and ${t.useCount} >= 0 and ${t.useCount} <= ${t.maximumUses}`,
    ),
  ],
);

export const designPolicies = sqliteTable(
  "design_policies",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    sourceHash: text("source_hash").notNull(),
    policyJson: text("policy_json").notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("design_policy_version_unique").on(t.version),
    uniqueIndex("design_policy_source_hash_unique").on(t.sourceHash),
  ],
);
export const surfaces = sqliteTable(
  "surfaces",
  {
    id: text("id").primaryKey(),
    ownerUserId: userRef("owner_user_id"),
    kind: text("kind", { enum: ["profile", "room", "circle"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    publishedRevisionId: text("published_revision_id"),
    governanceVersion: integer("governance_version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("surface_subject_unique").on(t.kind, t.subjectId),
    index("surface_owner_published_idx").on(t.ownerUserId, t.publishedRevisionId, t.updatedAt),
  ],
);
export const surfaceRevisions = sqliteTable(
  "surface_revisions",
  {
    id: text("id").primaryKey(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => surfaces.id),
    revisionNumber: integer("revision_number").notNull(),
    baseRevisionNumber: integer("base_revision_number"),
    authorUserId: userRef("author_user_id"),
    designPolicyId: text("design_policy_id")
      .notNull()
      .references(() => designPolicies.id),
    // Historical fixed default exists only to backfill pre-0006 rows. Runtime
    // repositories always supply the selected policy version explicitly; this
    // literal must not track a future deployment's active policy constant.
    designPolicyVersion: text("design_policy_version").notNull().default("2026-07-14.1"),
    visibility: text("visibility", { enum: ["private_preview", "personal_view"] }).notNull().default("private_preview"),
    specJson: text("spec_json").notNull(),
    status: text("status", {
      enum: ["draft", "proposed", "published", "rejected", "rolled_back"],
    })
      .notNull()
      .default("draft"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("surface_revision_number_unique").on(
      t.surfaceId,
      t.revisionNumber,
    ),
  ],
);
export const surfaceApprovals = sqliteTable(
  "surface_approvals",
  {
    revisionId: text("revision_id")
      .notNull()
      .references(() => surfaceRevisions.id),
    userId: userRef("user_id"),
    governanceVersion: integer("governance_version").notNull(),
    decision: text("decision", { enum: ["approved", "rejected"] }).notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.revisionId, t.userId] })],
);
export const personalSurfaceViews = sqliteTable(
  "personal_surface_views",
  {
    id: text("id").primaryKey(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => surfaces.id),
    userId: userRef("user_id"),
    revisionId: text("revision_id")
      .notNull()
      .references(() => surfaceRevisions.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("personal_surface_view_unique").on(t.surfaceId, t.userId),
  ],
);
export const surfaceAssets = sqliteTable(
  "surface_assets",
  {
    id: text("id").primaryKey(),
    ownerUserId: userRef("owner_user_id"),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: created(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("surface_asset_object_key_unique").on(t.objectKey)],
);

export const matchPairs = sqliteTable(
  "match_pairs",
  {
    id: text("id").primaryKey(),
    userAId: userRef("user_a_id"),
    userBId: userRef("user_b_id"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("match_pair_users_unique").on(t.userAId, t.userBId),
    check("match_pair_canonical", sql`${t.userAId} < ${t.userBId}`),
  ],
);
export const candidateBatches = sqliteTable(
  "candidate_batches",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    indexVersion: integer("index_version").notNull(),
    taxonomyVersion: integer("taxonomy_version").notNull(),
    candidateIdsJson: text("candidate_ids_json").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: created(),
  },
  (t) => [index("candidate_batch_user_expiry_id_idx").on(t.userId, t.expiresAt, t.id)],
);
export const matchProposals = sqliteTable(
  "match_proposals",
  {
    id: text("id").primaryKey(),
    matchPairId: text("match_pair_id")
      .notNull()
      .references(() => matchPairs.id),
    attemptNumber: integer("attempt_number").notNull(),
    evidenceVersionA: integer("evidence_version_a").notNull(),
    evidenceVersionB: integer("evidence_version_b").notNull(),
    taxonomyVersion: integer("taxonomy_version").notNull().default(1),
    weightVersion: integer("weight_version").notNull().default(1),
    acceptanceModeA: text("acceptance_mode_a", {
      enum: ["manual", "full_autopilot"],
    }).notNull(),
    acceptanceModeB: text("acceptance_mode_b", {
      enum: ["manual", "full_autopilot"],
    }).notNull(),
    explanationAJson: text("explanation_a_json").notNull(),
    explanationBJson: text("explanation_b_json").notNull(),
    sharedExplanationJson: text("shared_explanation_json"),
    state: text("state", {
      enum: ["pending", "matched", "declined", "expired", "invalidated"],
    })
      .notNull()
      .default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    terminalAt: integer("terminal_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("match_proposal_attempt_unique").on(
      t.matchPairId,
      t.attemptNumber,
    ),
    uniqueIndex("match_proposal_pair_identity_unique").on(t.id, t.matchPairId),
    check(
      "match_proposal_acceptance_a_valid",
      sql`${t.acceptanceModeA} in ('manual','full_autopilot')`,
    ),
    check(
      "match_proposal_acceptance_b_valid",
      sql`${t.acceptanceModeB} in ('manual','full_autopilot')`,
    ),
  ],
);
export const codexEvaluations = sqliteTable(
  "codex_evaluations",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => matchProposals.id),
    userId: userRef("user_id"),
    decision: text("decision", {
      enum: ["approve", "decline", "defer"],
    }).notNull(),
    reasonSummary: text("reason_summary").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    indexVersion: integer("index_version").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("evaluation_proposal_user_unique").on(t.proposalId, t.userId),
  ],
);
export const humanResponses = sqliteTable(
  "human_responses",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => matchProposals.id),
    userId: userRef("user_id"),
    response: text("response", { enum: ["interested", "decline"] }).notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("human_response_proposal_user_unique").on(
      t.proposalId,
      t.userId,
    ),
  ],
);
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    matchPairId: text("match_pair_id")
      .notNull()
      .references(() => matchPairs.id),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => matchProposals.id),
    matchedAt: integer("matched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("match_pair_terminal_unique").on(t.matchPairId),
    uniqueIndex("match_proposal_terminal_unique").on(t.proposalId),
    uniqueIndex("match_pair_identity_unique").on(t.id, t.matchPairId),
    foreignKey({
      columns: [t.proposalId, t.matchPairId],
      foreignColumns: [matchProposals.id, matchProposals.matchPairId],
      name: "match_proposal_pair_fk",
    }),
  ],
);

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    matchPairId: text("match_pair_id")
      .notNull()
      .references(() => matchPairs.id),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id),
    state: text("state", { enum: ["active", "ended", "blocked"] })
      .notNull()
      .default("active"),
    endedByUserId: text("ended_by_user_id").references(() => users.id),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("connection_pair_unique").on(t.matchPairId),
    uniqueIndex("connection_match_unique").on(t.matchId),
    uniqueIndex("connection_pair_identity_unique").on(t.id, t.matchPairId),
    foreignKey({
      columns: [t.matchId, t.matchPairId],
      foreignColumns: [matches.id, matches.matchPairId],
      name: "connection_match_pair_fk",
    }),
  ],
);
export const connectionSides = sqliteTable(
  "connection_sides",
  {
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    userId: userRef("user_id"),
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    renewedRelevanceEnabled: integer("renewed_relevance_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    renewedRelevanceAcknowledgedAt: integer(
      "renewed_relevance_acknowledged_at",
      { mode: "timestamp_ms" },
    ),
    unreadAt: integer("unread_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    primaryKey({ columns: [t.connectionId, t.userId] }),
    index("connection_side_user_connection_idx").on(t.userId, t.connectionId),
  ],
);
export const connectionPrivateNotes = sqliteTable(
  "connection_private_notes",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    ownerUserId: userRef("owner_user_id"),
    body: text("body").notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("connection_note_owner_idx").on(t.connectionId, t.ownerUserId),
    index("connection_note_owner_id_idx").on(t.ownerUserId, t.id),
    index("connection_note_owner_connection_id_idx").on(t.ownerUserId, t.connectionId, t.id),
  ],
);
export const connectionReminders = sqliteTable(
  "connection_reminders",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").notNull().references(() => connections.id),
    userId: userRef("user_id"),
    remindAt: integer("remind_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["scheduled", "sent", "dismissed"] }).notNull().default("scheduled"),
    createdAt: created(),
  },
  (t) => [
    index("connection_reminder_user_id_idx").on(t.userId, t.id),
    index("connection_reminder_user_connection_id_idx").on(t.userId, t.connectionId, t.id),
  ],
);
export const connectionUpdateSubscriptions = sqliteTable(
  "connection_update_subscriptions",
  {
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    subscriberUserId: userRef("subscriber_user_id"),
    subjectUserId: userRef("subject_user_id"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    primaryKey({ columns: [t.connectionId, t.subscriberUserId] }),
    check(
      "connection_subscription_other_side",
      sql`${t.subscriberUserId} <> ${t.subjectUserId}`,
    ),
  ],
);
export const reconnectRequests = sqliteTable("reconnect_requests", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id")
    .notNull()
    .references(() => connections.id),
  requesterUserId: userRef("requester_user_id"),
  response: text("response", { enum: ["pending", "accepted", "declined"] })
    .notNull()
    .default("pending"),
  createdAt: created(),
  respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
}, (t) => [
  uniqueIndex("reconnect_one_pending_per_connection").on(t.connectionId).where(sql`${t.response} = 'pending'`),
]);

export const connectionSnapshots = sqliteTable(
  "connection_snapshots",
  {
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    subjectUserId: userRef("subject_user_id"),
    displayName: text("display_name").notNull(),
    summary: text("summary").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.subjectUserId] })],
);
export const connectionContextSnapshots = sqliteTable("connection_context_snapshots", {
  connectionId: text("connection_id").primaryKey().references(() => connections.id),
  reason: text("reason").notNull(),
  sharedContextJson: text("shared_context_json").notNull().default("[]"),
  themeTopicId: text("theme_topic_id").references(() => topics.id),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
});

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    matchPairId: text("match_pair_id")
      .notNull()
      .references(() => matchPairs.id),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    status: text("status", { enum: ["active", "ended", "deleted"] })
      .notNull()
      .default("active"),
    themeTopicId: text("theme_topic_id").references(() => topics.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("room_pair_unique").on(t.matchPairId),
    uniqueIndex("room_connection_unique").on(t.connectionId),
    foreignKey({
      columns: [t.connectionId, t.matchPairId],
      foreignColumns: [connections.id, connections.matchPairId],
      name: "room_connection_pair_fk",
    }),
  ],
);
export const roomMemberships = sqliteTable(
  "room_memberships",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    userId: userRef("user_id"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
    leftAt: integer("left_at", { mode: "timestamp_ms" }),
    lastReadMessageId: text("last_read_message_id"),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    index("room_membership_user_active_room_idx").on(t.userId, t.leftAt, t.roomId),
  ],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    senderUserId: userRef("sender_user_id"),
    clientMessageId: text("client_message_id").notNull(),
    body: text("body").notNull(),
    createdAt: created(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("message_client_id_unique").on(
      t.roomId,
      t.senderUserId,
      t.clientMessageId,
    ),
    index("messages_room_created_idx").on(t.roomId, t.createdAt),
  ],
);
export const introductionFeedback = sqliteTable(
  "introduction_feedback",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    userId: userRef("user_id"),
    useful: integer("useful", { mode: "boolean" }).notNull(),
    reasonsJson: text("reasons_json").notNull().default("[]"),
    similarMatchPreference: text("similar_match_preference"),
    followUpIntent: text("follow_up_intent"),
    privateNote: text("private_note"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("feedback_connection_user_unique").on(t.connectionId, t.userId),
  ],
);
export const roomUpgradeProposals = sqliteTable("room_upgrade_proposals", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  proposerUserId: userRef("proposer_user_id"),
  modulesJson: text("modules_json").notNull(),
  explanation: text("explanation").notNull(),
  status: text("status", {
    enum: ["proposed", "accepted", "declined", "activated"],
  })
    .notNull()
    .default("proposed"),
  createdAt: created(),
});
export const roomUpgradeResponses = sqliteTable(
  "room_upgrade_responses",
  {
    proposalId: text("proposal_id")
      .notNull()
      .references(() => roomUpgradeProposals.id),
    userId: userRef("user_id"),
    response: text("response", { enum: ["accepted", "declined"] }).notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.userId] })],
);
export const roomModules = sqliteTable(
  "room_modules",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id),
    proposalId: text("proposal_id").notNull().references(() => roomUpgradeProposals.id),
    kind: text("kind", {
      enum: ["resource_shelf", "experiment_tracker", "decision_log", "feedback_queue", "milestone_tracker"],
    }).notNull(),
    configJson: text("config_json").notNull().default("{}"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("room_module_kind_unique").on(t.roomId, t.kind),
    index("room_module_room_idx").on(t.roomId, t.active),
  ],
);
export const roomModuleEntries = sqliteTable(
  "room_module_entries",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id").notNull().references(() => roomModules.id),
    authorUserId: userRef("author_user_id"),
    payloadJson: text("payload_json").notNull(),
    createdAt: created(),
    updatedAt: updated(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("room_module_entry_module_time_idx").on(t.moduleId, t.deletedAt, t.createdAt)],
);
export const meetingProposals = sqliteTable(
  "meeting_proposals",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id),
    proposerUserId: userRef("proposer_user_id"),
    parentProposalId: text("parent_proposal_id"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    timezone: text("timezone").notNull(),
    note: text("note"),
    status: text("status", { enum: ["proposed", "accepted", "declined", "countered", "cancelled"] })
      .notNull()
      .default("proposed"),
    respondedByUserId: text("responded_by_user_id").references(() => users.id),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("meeting_proposal_room_status_idx").on(t.roomId, t.status, t.createdAt),
    check("meeting_proposal_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
export const availabilityWindows = sqliteTable("availability_windows", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  userId: userRef("user_id"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  timezone: text("timezone").notNull(),
  status: text("status", { enum: ["approved", "withdrawn"] }).notNull().default("approved"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("availability_window_owner_interval_unique").on(t.roomId, t.userId, t.startsAt, t.endsAt),
  index("availability_window_room_status_time_idx").on(t.roomId, t.status, t.startsAt, t.endsAt),
  check("availability_window_time_order", sql`${t.endsAt} > ${t.startsAt}`),
]);

export const circles = sqliteTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status", {
    enum: ["proposed", "invited", "active", "archived", "deleted"],
  })
    .notNull()
    .default("proposed"),
  governanceMode: text("governance_mode", { enum: ["admin", "vote"] })
    .notNull()
    .default("admin"),
  governanceVersion: integer("governance_version").notNull().default(1),
  createdAt: created(),
  updatedAt: updated(),
});
export const circleMemberships = sqliteTable(
  "circle_memberships",
  {
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id),
    userId: userRef("user_id"),
    role: text("role", { enum: ["member", "admin", "owner"] })
      .notNull()
      .default("member"),
    status: text("status", {
      enum: ["invited", "accepted", "declined", "active", "left", "removed"],
    })
      .notNull()
      .default("invited"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.circleId, t.userId] }),
    index("circle_membership_user_status_circle_idx").on(t.userId, t.status, t.circleId),
  ],
);
export const circleMessages = sqliteTable("circle_messages", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull().references(() => circles.id),
  senderUserId: userRef("sender_user_id"),
  clientMessageId: text("client_message_id").notNull(),
  body: text("body").notNull(),
  createdAt: created(),
  editedAt: integer("edited_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => [
  uniqueIndex("circle_message_client_unique").on(t.circleId, t.senderUserId, t.clientMessageId),
  index("circle_message_circle_time_idx").on(t.circleId, t.createdAt, t.id),
]);
export const circleProposals = sqliteTable("circle_proposals", {
  id: text("id").primaryKey(),
  circleId: text("circle_id")
    .notNull()
    .references(() => circles.id),
  proposerUserId: userRef("proposer_user_id"),
  kind: text("kind", {
    enum: ["design", "module", "rules", "membership"],
  }).notNull(),
  payloadJson: text("payload_json").notNull(),
  governanceVersion: integer("governance_version").notNull(),
  status: text("status", {
    enum: ["draft", "voting", "approved", "rejected", "published"],
  })
    .notNull()
    .default("draft"),
  createdAt: created(),
});
export const circleVotes = sqliteTable(
  "circle_votes",
  {
    proposalId: text("proposal_id")
      .notNull()
      .references(() => circleProposals.id),
    userId: userRef("user_id"),
    vote: text("vote", { enum: ["approve", "reject", "abstain"] }).notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.userId] })],
);
export const circleModules = sqliteTable("circle_modules", {
  id: text("id").primaryKey(),
  circleId: text("circle_id")
    .notNull()
    .references(() => circles.id),
  kind: text("kind", {
    enum: [
      "resource_shelf",
      "experiment_tracker",
      "decision_log",
      "feedback_queue",
      "milestone_tracker",
      "scoreboard",
    ],
  }).notNull(),
  configJson: text("config_json").notNull(),
  rulesVersion: integer("rules_version").notNull().default(1),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});
export const circleModuleEntries = sqliteTable("circle_module_entries", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => circleModules.id),
  authorUserId: userRef("author_user_id"),
  payloadJson: text("payload_json").notNull(),
  createdAt: created(),
  updatedAt: updated(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
export const circleModuleRuleVersions = sqliteTable(
  "circle_module_rule_versions",
  {
    moduleId: text("module_id").notNull().references(() => circleModules.id),
    version: integer("version").notNull(),
    proposalId: text("proposal_id").notNull().references(() => circleProposals.id),
    rulesJson: text("rules_json").notNull(),
    approvedByUserId: userRef("approved_by_user_id"),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.moduleId, t.version] }),
    uniqueIndex("circle_module_rule_proposal_unique").on(t.proposalId),
  ],
);
export const circleMetrics = sqliteTable("circle_metrics", {
  id: text("id").primaryKey(),
  circleId: text("circle_id")
    .notNull()
    .references(() => circles.id),
  name: text("name").notNull(),
  ruleJson: text("rule_json").notNull(),
  rulesVersion: integer("rules_version").notNull().default(1),
  rankingOptOutAllowed: integer("ranking_opt_out_allowed", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: created(),
  updatedAt: updated(),
});
export const circleMetricEntries = sqliteTable(
  "circle_metric_entries",
  {
    id: text("id").primaryKey(),
    metricId: text("metric_id")
      .notNull()
      .references(() => circleMetrics.id),
    userId: userRef("user_id"),
    value: integer("value").notNull(),
    evidence: text("evidence"),
    periodKey: text("period_key").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("circle_metric_user_period_unique").on(
      t.metricId,
      t.userId,
      t.periodKey,
    ),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    kind: text("kind").notNull(),
    delivery: text("delivery", { enum: ["immediate", "digest"] })
      .notNull()
      .default("immediate"),
    payloadJson: text("payload_json").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [index("notification_inbox_idx").on(t.userId, t.readAt, t.createdAt)],
);
export const automationCheckpoints = sqliteTable(
  "automation_checkpoints",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    kind: text("kind").notNull(),
    cursor: text("cursor"),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }),
    stateJson: text("state_json").notNull().default("{}"),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("automation_user_kind_unique").on(t.userId, t.kind)],
);

export const blocks = sqliteTable(
  "blocks",
  {
    blockerUserId: userRef("blocker_user_id"),
    blockedUserId: userRef("blocked_user_id"),
    createdAt: created(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.blockerUserId, t.blockedUserId] }),
    check("block_no_self", sql`${t.blockerUserId} <> ${t.blockedUserId}`),
  ],
);
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterUserId: userRef("reporter_user_id"),
  targetKind: text("target_kind").notNull(),
  targetId: text("target_id").notNull(),
  reasonCode: text("reason_code").notNull(),
  details: text("details"),
  status: text("status", {
    enum: ["received", "reviewing", "actioned", "closed"],
  })
    .notNull()
    .default("received"),
  createdAt: created(),
  updatedAt: updated(),
});
export const moderationCases = sqliteTable(
  "moderation_cases",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id),
    assignedOperatorId: text("assigned_operator_id").references(() => users.id),
    status: text("status", {
      enum: ["open", "reviewing", "actioned", "closed", "appealed"],
    })
      .notNull()
      .default("open"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("moderation_case_report_unique").on(t.reportId)],
);
export const moderationActions = sqliteTable("moderation_actions", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => moderationCases.id),
  operatorUserId: userRef("operator_user_id"),
  action: text("action").notNull(),
  reasonCode: text("reason_code").notNull(),
  createdAt: created(),
});
export const moderationAppeals = sqliteTable("moderation_appeals", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => moderationCases.id),
  appellantUserId: userRef("appellant_user_id"),
  statement: text("statement").notNull(),
  status: text("status", {
    enum: ["received", "reviewing", "upheld", "reversed"],
  })
    .notNull()
    .default("received"),
  createdAt: created(),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
});
export const exportJobs = sqliteTable("export_jobs", {
  id: text("id").primaryKey(),
  userId: userRef("user_id"),
  status: text("status", {
    enum: ["queued", "processing", "ready", "failed", "expired"],
  })
    .notNull()
    .default("queued"),
  objectKey: text("object_key"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdAt: created(),
  updatedAt: updated(),
});
export const deletionJobs = sqliteTable("deletion_jobs", {
  id: text("id").primaryKey(),
  userId: userRef("user_id"),
  status: text("status", {
    enum: ["queued", "redacting", "deleting", "complete", "failed"],
  })
    .notNull()
    .default("queued"),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  updatedAt: updated(),
});
export const redactionJobs = sqliteTable(
  "redaction_jobs",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    sourceKind: text("source_kind").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status", {
      enum: ["queued", "processing", "complete", "failed"],
    })
      .notNull()
      .default("queued"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("redaction_source_unique").on(
      t.userId,
      t.sourceKind,
      t.sourceId,
    ),
  ],
);
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    objectKind: text("object_kind").notNull(),
    objectId: text("object_id").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    idempotencyKey: text("idempotency_key"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("audit_idempotency_unique").on(t.idempotencyKey),
    index("audit_object_idx").on(t.objectKind, t.objectId, t.createdAt),
  ],
);
export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    actorUserId: userRef("actor_user_id"),
    operation: text("operation").notNull(),
    keyHash: text("key_hash").notNull(),
    requestHash: text("request_hash").notNull(),
    responseJson: text("response_json"),
    status: text("status", { enum: ["processing", "complete", "failed"] })
      .notNull()
      .default("processing"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("idempotency_actor_operation_key_unique").on(
      t.actorUserId,
      t.operation,
      t.keyHash,
    ),
  ],
);

export const setupStates = sqliteTable("setup_states", {
  userId: userRef("user_id").primaryKey(),
  completedStepsJson: text("completed_steps_json").notNull().default('["identity_link"]'),
  updatedAt: updated(),
});

export const sourceUseApprovals = sqliteTable(
  "source_use_approvals",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    sourceAppId: text("source_app_id").notNull(),
    purpose: text("purpose", { enum: ["work_signal"] }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: created(),
  },
  (t) => [index("source_use_approval_lookup_idx").on(t.userId, t.sourceAppId, t.expiresAt)],
);

export const calendarEventReceipts = sqliteTable(
  "calendar_event_receipts",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id),
    meetingProposalId: text("meeting_proposal_id").references(() => meetingProposals.id),
    attachedByUserId: userRef("attached_by_user_id"),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    participantLabelsJson: text("participant_labels_json").notNull(),
    status: text("status", { enum: ["confirmed", "cancelled"] }).notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("calendar_provider_event_unique").on(t.provider, t.providerEventId)],
);
