import { createHash, randomBytes } from "node:crypto";

export type DiscoveryBuilder = {
  userId: string;
  handle: string;
  displayName: string;
  summary: string;
  coarseLocation: string | null;
  currentWork: string | null;
  projectCount: number;
};

export type DiscoveryProject = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  stage: string;
  ownerHandle: string;
  ownerName: string;
  topics: string[];
};

export type CohortSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: "public" | "request" | "invite" | "private";
  memberCount: number;
  viewerRole: string | null;
  viewerStatus: string | null;
};

function searchPattern(query: string) {
  return `%${query.trim().toLowerCase().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function visibleAudience(viewerId: string | null, alias: string) {
  return viewerId
    ? `(${alias}.audience='public' OR ${alias}.audience='signed_in')`
    : `${alias}.audience='public'`;
}

function blockClause(owner: string) {
  return `NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=${owner} AND b.blocked_user_id=?) OR (b.blocked_user_id=${owner} AND b.blocker_user_id=?)))`;
}

export async function listDiscovery(
  db: D1Database,
  viewerId: string | null,
  options: { query?: string; location?: string; stage?: string; limit?: number } = {},
) {
  const query = options.query?.trim().slice(0, 100) ?? "";
  const location = options.location?.trim().slice(0, 100) ?? "";
  const stage = options.stage?.trim().slice(0, 60) ?? "";
  const limit = Math.max(1, Math.min(options.limit ?? 30, 50));
  const viewer = viewerId ?? "";
  const pattern = searchPattern(query);

  const builders = await db
    .prepare(
      `SELECT p.user_id AS userId,h.handle,p.display_name AS displayName,p.summary,p.coarse_location AS coarseLocation,
        (SELECT json_extract(f.value_json,'$') FROM profile_fields f WHERE f.profile_id=p.id AND f.field_key='current_work' AND ${visibleAudience(viewerId, "f")} LIMIT 1) AS currentWork,
        (SELECT count(*) FROM projects x WHERE x.owner_user_id=p.user_id AND x.status='active' AND x.published_at IS NOT NULL AND ${visibleAudience(viewerId, "x")}) AS projectCount
       FROM profiles p JOIN handles h ON h.user_id=p.user_id
       WHERE p.published_at IS NOT NULL AND ${visibleAudience(viewerId, "p")} AND ${blockClause("p.user_id")}
         AND (?='' OR lower(p.display_name) LIKE ? ESCAPE '\\' OR lower(p.summary) LIKE ? ESCAPE '\\' OR lower(h.handle) LIKE ? ESCAPE '\\'
           OR EXISTS (SELECT 1 FROM profile_fields sf WHERE sf.profile_id=p.id AND ${visibleAudience(viewerId, "sf")} AND lower(sf.value_json) LIKE ? ESCAPE '\\'))
         AND (?='' OR lower(COALESCE(p.coarse_location,''))=lower(?))
       ORDER BY p.updated_at DESC,p.user_id LIMIT ?`,
    )
    .bind(viewer, viewer, query, pattern, pattern, pattern, pattern, location, location, limit)
    .all<DiscoveryBuilder>();

  const projects = await db
    .prepare(
      `SELECT x.id,x.slug,x.title,x.summary,x.stage,h.handle AS ownerHandle,p.display_name AS ownerName,
        COALESCE((SELECT json_group_array(pt.taxonomy_item_id) FROM project_taxonomy_items pt WHERE pt.project_id=x.id AND pt.kind='topic'),'[]') AS topicsJson
       FROM projects x JOIN profiles p ON p.user_id=x.owner_user_id JOIN handles h ON h.user_id=x.owner_user_id
       WHERE x.status='active' AND x.published_at IS NOT NULL AND p.published_at IS NOT NULL
         AND ${visibleAudience(viewerId, "x")} AND ${visibleAudience(viewerId, "p")} AND ${blockClause("x.owner_user_id")}
         AND (?='' OR lower(x.title) LIKE ? ESCAPE '\\' OR lower(x.summary) LIKE ? ESCAPE '\\' OR lower(h.handle) LIKE ? ESCAPE '\\'
           OR EXISTS (SELECT 1 FROM project_taxonomy_items pt WHERE pt.project_id=x.id AND lower(pt.taxonomy_item_id) LIKE ? ESCAPE '\\'))
         AND (?='' OR lower(x.stage)=lower(?))
       ORDER BY x.updated_at DESC,x.id LIMIT ?`,
    )
    .bind(viewer, viewer, query, pattern, pattern, pattern, pattern, stage, stage, limit)
    .all<Omit<DiscoveryProject, "topics"> & { topicsJson: string }>();

  return {
    builders: builders.results.map((builder) => ({
      ...builder,
      projectCount: Number(builder.projectCount),
      currentWork: typeof builder.currentWork === "string" ? builder.currentWork : null,
    })),
    projects: projects.results.map(({ topicsJson, ...project }) => ({
      ...project,
      topics: safeStringArray(topicsJson),
    })),
  };
}

export async function listLocationGroups(db: D1Database, viewerId: string | null) {
  const viewer = viewerId ?? "";
  const rows = await db
    .prepare(
      `SELECT p.coarse_location AS location,count(*) AS builderCount
       FROM profiles p WHERE p.published_at IS NOT NULL AND p.coarse_location IS NOT NULL AND trim(p.coarse_location)<>''
       AND ${visibleAudience(viewerId, "p")} AND ${blockClause("p.user_id")}
       GROUP BY lower(p.coarse_location),p.coarse_location ORDER BY builderCount DESC,p.coarse_location LIMIT 80`,
    )
    .bind(viewer, viewer)
    .all<{ location: string; builderCount: number }>();
  return rows.results.map((row) => ({ ...row, builderCount: Number(row.builderCount) }));
}

export async function getBuildGraph(db: D1Database, viewerId: string | null) {
  const viewer = viewerId ?? "";
  const projects = await db
    .prepare(
      `SELECT x.id,x.slug,x.title,h.handle,p.display_name AS ownerName
       FROM projects x JOIN profiles p ON p.user_id=x.owner_user_id JOIN handles h ON h.user_id=x.owner_user_id
       WHERE x.status='active' AND x.published_at IS NOT NULL AND p.published_at IS NOT NULL
       AND ${visibleAudience(viewerId, "x")} AND ${visibleAudience(viewerId, "p")} AND ${blockClause("x.owner_user_id")}
       ORDER BY x.updated_at DESC LIMIT 40`,
    )
    .bind(viewer, viewer)
    .all<{ id: string; slug: string; title: string; handle: string; ownerName: string }>();
  if (!projects.results.length) return { projects: [], topics: [], edges: [] };
  const placeholders = projects.results.map(() => "?").join(",");
  const topics = await db
    .prepare(
      `SELECT project_id AS projectId,taxonomy_item_id AS topicId FROM project_taxonomy_items WHERE kind='topic' AND project_id IN (${placeholders}) ORDER BY taxonomy_item_id,project_id`,
    )
    .bind(...projects.results.map((project) => project.id))
    .all<{ projectId: string; topicId: string }>();
  return {
    projects: projects.results,
    topics: [...new Set(topics.results.map((topic) => topic.topicId))],
    edges: topics.results,
  };
}

export async function listCohorts(db: D1Database, viewerId: string | null) {
  const rows = await db
    .prepare(
      `SELECT c.id,c.slug,c.name,c.description,c.visibility,
        (SELECT count(*) FROM cohort_memberships cm WHERE cm.cohort_id=c.id AND cm.status='active') AS memberCount,
        cm.role AS viewerRole,cm.status AS viewerStatus
       FROM cohorts c LEFT JOIN cohort_memberships cm ON cm.cohort_id=c.id AND cm.user_id=?
       WHERE c.status='active' AND (c.visibility IN ('public','request') OR cm.status IN ('active','invited','requested'))
       ORDER BY memberCount DESC,c.name`,
    )
    .bind(viewerId ?? "")
    .all<CohortSummary>();
  return rows.results.map((row) => ({ ...row, memberCount: Number(row.memberCount) }));
}

export async function createCohort(db: D1Database, userId: string, input: { name: string; slug: string; description: string; visibility: "public" | "request" | "invite" | "private" }) {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const description = input.description.trim();
  if (!name || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 72 || !description || description.length > 800 || !["public", "request", "invite", "private"].includes(input.visibility)) throw new Error("invalid_cohort");
  const id = `cohort_${crypto.randomUUID()}`;
  const now = Date.now();
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
    db.prepare("INSERT INTO cohorts(id,slug,name,description,visibility,community_created,status,created_at,updated_at) VALUES (?,?,?,?,?,1,'active',?,?)").bind(id, slug, name, description, input.visibility, now, now),
    db.prepare("INSERT INTO cohort_memberships(cohort_id,user_id,role,status,joined_at) VALUES (?,?,'owner','active',?)").bind(id, userId, now),
  ]);
  if (results.some((result) => !result.success)) throw new Error("cohort_create_failed");
  return { id, slug };
}

export async function getCohort(db: D1Database, slug: string, viewerId: string | null) {
  const cohort = (await listCohorts(db, viewerId)).find((item) => item.slug === slug);
  if (!cohort) return null;
  const canSeeRoster = ["public", "request"].includes(cohort.visibility) || cohort.viewerStatus === "active";
  if (!canSeeRoster) return { ...cohort, members: [] as { handle: string; displayName: string; summary: string; role: string }[] };
  const members = await db
    .prepare(
      `SELECT h.handle,p.display_name AS displayName,p.summary,cm.role
       FROM cohort_memberships cm JOIN profiles p ON p.user_id=cm.user_id JOIN handles h ON h.user_id=cm.user_id
       WHERE cm.cohort_id=? AND cm.status='active' AND p.published_at IS NOT NULL
       AND (p.audience='public' OR (?<>'' AND p.audience='signed_in')) AND ${blockClause("cm.user_id")}
       ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,p.display_name LIMIT 60`,
    )
    .bind(cohort.id, viewerId ?? "", viewerId ?? "", viewerId ?? "")
    .all<{ handle: string; displayName: string; summary: string; role: string }>();
  return { ...cohort, members: members.results };
}

export async function requestCohortMembership(db: D1Database, userId: string, cohortId: string) {
  const now = Date.now();
  const cohort = await db.prepare("SELECT visibility FROM cohorts WHERE id=? AND status='active'").bind(cohortId).first<{ visibility: string }>();
  if (!cohort || !["public", "request"].includes(cohort.visibility)) throw new Error("cohort_not_joinable");
  const status = cohort.visibility === "public" ? "active" : "requested";
  const role = "member";
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
    db.prepare("INSERT INTO cohort_memberships(cohort_id,user_id,role,status,joined_at) VALUES (?,?,?,?,?) ON CONFLICT(cohort_id,user_id) DO UPDATE SET status=CASE WHEN cohort_memberships.status IN ('removed','left','declined') THEN excluded.status ELSE cohort_memberships.status END,joined_at=CASE WHEN excluded.status='active' THEN COALESCE(cohort_memberships.joined_at,excluded.joined_at) ELSE cohort_memberships.joined_at END").bind(cohortId, userId, role, status, status === "active" ? now : null),
  ]);
  if (results.some((result) => !result.success)) throw new Error("membership_request_failed");
  return { status };
}

export async function createInviteLink(
  db: D1Database,
  userId: string,
  input: { kind: "personal" | "cohort_admin" | "builder" | "connection_card"; targetId?: string; maximumUses?: number },
) {
  const now = Date.now();
  const maximumUses = Math.max(1, Math.min(input.maximumUses ?? 20, 100));
  if (input.kind === "personal" && input.targetId) throw new Error("invalid_invite_target");
  if (input.kind === "cohort_admin") {
    if (!input.targetId) throw new Error("invalid_invite_target");
    const membership = await db.prepare("SELECT role FROM cohort_memberships WHERE cohort_id=? AND user_id=? AND status='active'").bind(input.targetId ?? "", userId).first<{ role: string }>();
    if (!membership || !["owner", "admin"].includes(membership.role)) throw new Error("forbidden");
  }
  if (input.kind === "builder") {
    if (!input.targetId) throw new Error("invalid_invite_target");
    const owner = await db.prepare("SELECT user_id AS userId FROM profiles WHERE id=?").bind(input.targetId ?? "").first<{ userId: string }>();
    if (!owner || owner.userId !== userId) throw new Error("forbidden");
  }
  if (input.kind === "connection_card" && input.targetId) {
    const owner = await db.prepare("SELECT owner_user_id AS userId FROM projects WHERE id=? AND status<>'deleted'").bind(input.targetId).first<{ userId: string }>();
    if (!owner || owner.userId !== userId) throw new Error("forbidden");
  }
  const token = randomBytes(24).toString("base64url");
  const id = `invite_${crypto.randomUUID()}`;
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
    db.prepare("INSERT INTO invite_links(id,creator_user_id,kind,token_hash,target_id,maximum_uses,use_count,expires_at,created_at) VALUES (?,?,?,?,?,?,0,?,?)").bind(id, userId, input.kind, hashToken(token), input.targetId ?? null, maximumUses, expiresAt, now),
  ]);
  if (results.some((result) => !result.success)) throw new Error("invite_create_failed");
  return { id, token, expiresAt, maximumUses };
}

export async function getInvite(db: D1Database, token: string) {
  return db.prepare(
    `SELECT i.id,i.kind,i.target_id AS targetId,i.maximum_uses AS maximumUses,i.use_count AS useCount,i.expires_at AS expiresAt,
      p.display_name AS creatorName,h.handle AS creatorHandle,c.name AS cohortName,c.slug AS cohortSlug
     FROM invite_links i LEFT JOIN profiles p ON p.user_id=i.creator_user_id LEFT JOIN handles h ON h.user_id=i.creator_user_id
     LEFT JOIN cohorts c ON c.id=i.target_id
     WHERE i.token_hash=? AND i.revoked_at IS NULL AND i.expires_at>? AND i.use_count<i.maximum_uses`,
  ).bind(hashToken(token), Date.now()).first<{ id: string; kind: string; targetId: string | null; maximumUses: number; useCount: number; expiresAt: number; creatorName: string | null; creatorHandle: string | null; cohortName: string | null; cohortSlug: string | null }>();
}

export async function acceptInvite(db: D1Database, token: string, userId: string) {
  const invite = await getInvite(db, token);
  if (!invite) throw new Error("invite_not_found");
  const now = Date.now();
  const statements = [
    db.prepare("INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
  ];
  if (invite.kind === "cohort_admin" && invite.targetId) {
    statements.push(db.prepare("INSERT INTO cohort_memberships(cohort_id,user_id,role,status,joined_at) SELECT ?,?,'member','active',? WHERE EXISTS (SELECT 1 FROM invite_links WHERE id=? AND revoked_at IS NULL AND expires_at>? AND use_count<maximum_uses) ON CONFLICT(cohort_id,user_id) DO UPDATE SET status='active',joined_at=COALESCE(cohort_memberships.joined_at,excluded.joined_at)").bind(invite.targetId, userId, now, invite.id, now));
  }
  statements.push(db.prepare("UPDATE invite_links SET use_count=use_count+1 WHERE id=? AND revoked_at IS NULL AND expires_at>? AND use_count<maximum_uses").bind(invite.id, now));
  const results = await db.batch(statements);
  if (results.some((result) => !result.success) || Number(results.at(-1)?.meta?.changes ?? 0) !== 1) throw new Error("invite_not_found");
  return { kind: invite.kind, cohortSlug: invite.cohortSlug, creatorHandle: invite.creatorHandle };
}

export async function setRelevantBuilderWatch(db: D1Database, userId: string, enabled: boolean) {
  const now = Date.now();
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
    db.prepare("INSERT INTO watches(id,user_id,kind,target_id,created_at,revoked_at) VALUES (?,?,'relevant_builder','network',?,?) ON CONFLICT(user_id,kind,target_id) DO UPDATE SET revoked_at=excluded.revoked_at").bind(`watch_${crypto.randomUUID()}`, userId, now, enabled ? null : now),
  ]);
  if (results.some((result) => !result.success)) throw new Error("watch_update_failed");
  return { enabled };
}

export async function getRelevantBuilderWatch(db: D1Database, userId: string) {
  const row = await db.prepare("SELECT revoked_at AS revokedAt FROM watches WHERE user_id=? AND kind='relevant_builder' AND target_id='network'").bind(userId).first<{ revokedAt: number | null }>();
  return Boolean(row && row.revokedAt === null);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}
