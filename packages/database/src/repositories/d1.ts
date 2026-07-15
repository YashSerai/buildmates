import {
  acceptanceModeSchema,
  appAccessModeSchema,
  audienceSchema,
} from "@buildmates/domain";
import { isSurfacePolicyCompatible, parseSurfaceSpecJson } from "@buildmates/surfaces/schema";
import type {
  BuildmatesRepositories,
  Cohort,
  CohortId,
  ConnectedAppPreference,
  ConnectionId,
  ConnectionRecord,
  MessageRecord,
  NotificationRecord,
  PrivateResource,
  Profile,
  ProfileId,
  ProjectId,
  ProjectRecord,
  ReportRecord,
  RoomId,
  SurfaceRevisionRecord,
  User,
  UserId,
  WorkSignalRecord,
} from "@buildmates/domain";

type Result = { success: boolean; meta?: { changes?: number } };
type BoundStatement = {
  run(): Promise<Result>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};
type Statement = { bind(...values: unknown[]): BoundStatement };
export type RepositoryD1 = {
  prepare(query: string): Statement;
  batch(statements: BoundStatement[]): Promise<Result[]>;
};

export function createD1Repositories(DB: RepositoryD1): BuildmatesRepositories {
  const repository: BuildmatesRepositories = {
    users: {
      async create(user) {
        await run(
          DB,
          "INSERT INTO users (id, status, operator_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          user.id,
          user.status,
          user.operatorRole,
          ms(user.createdAt),
          ms(user.createdAt),
        );
      },
      async findById(id) {
        const row = await first<{
          id: string;
          status: User["status"];
          operatorRole: User["operatorRole"];
          createdAt: number;
        }>(
          DB,
          "SELECT id, status, operator_role AS operatorRole, created_at AS createdAt FROM users WHERE id = ? AND status <> 'deleted' LIMIT 1",
          id,
        );
        return row
          ? { ...row, id: row.id as UserId, createdAt: new Date(row.createdAt) }
          : null;
      },
    },
    profiles: {
      async create(profile) {
        audienceSchema.parse(profile.audience);
        acceptanceModeSchema.parse(profile.acceptanceMode);
        await assertSelfD1(profile.actorId, profile.userId);
        const now = Date.now();
        await batch(DB, [
          [
            "INSERT INTO handles (user_id, handle, normalized_handle, created_at) VALUES (?, ?, ?, ?)",
            profile.userId,
            profile.handle,
            profile.handle.trim().toLowerCase(),
            now,
          ],
          [
            "INSERT INTO profiles (id, user_id, display_name, summary, audience, cohort_scope_id, allow_matching, acceptance_mode, indexable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
            profile.id,
            profile.userId,
            profile.displayName,
            profile.summary,
            profile.audience,
            profile.cohortScopeId,
            profile.allowMatching ? 1 : 0,
            profile.acceptanceMode,
            now,
            now,
          ],
        ]);
      },
      async findByIdForViewer(id, viewerId) {
        const row = await first<{
          id: string;
          userId: string;
          handle: string;
          displayName: string;
          summary: string;
          audience: Profile["audience"];
          cohortScopeId: string | null;
          allowMatching: number;
          acceptanceMode: Profile["acceptanceMode"];
        }>(
          DB,
          `SELECT p.id, p.user_id AS userId, h.handle, p.display_name AS displayName, p.summary, p.audience, p.cohort_scope_id AS cohortScopeId, p.allow_matching AS allowMatching, p.acceptance_mode AS acceptanceMode FROM profiles p JOIN handles h ON h.user_id = p.user_id WHERE p.id = ? AND ${audiencePredicate("p")} LIMIT 1`,
          id,
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
          viewerId ?? "",
        );
        return row
          ? {
              ...row,
              id: row.id as ProfileId,
              userId: row.userId as UserId,
              cohortScopeId: row.cohortScopeId as CohortId | null,
              allowMatching: Boolean(row.allowMatching),
            }
          : null;
      },
    },
    connectedApps: {
      async save(value) {
        appAccessModeSchema.parse(value.accessMode);
        await assertSelfD1(value.actorId, value.userId);
        await run(
          DB,
          "INSERT INTO connected_app_preferences (id, user_id, app_id, display_name, category, access_mode, last_reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, app_id) DO UPDATE SET display_name=excluded.display_name, category=excluded.category, access_mode=excluded.access_mode, last_reviewed_at=excluded.last_reviewed_at",
          value.id,
          value.userId,
          value.appId,
          value.displayName,
          value.category,
          value.accessMode,
          ms(value.lastReviewedAt),
        );
      },
      async listForUser(userId) {
        const rows = await all<{
          id: string;
          userId: string;
          appId: string;
          displayName: string;
          category: string;
          accessMode: ConnectedAppPreference["accessMode"];
          lastReviewedAt: number;
        }>(
          DB,
          "SELECT id, user_id AS userId, app_id AS appId, display_name AS displayName, category, access_mode AS accessMode, last_reviewed_at AS lastReviewedAt FROM connected_app_preferences WHERE user_id=? AND revoked_at IS NULL ORDER BY app_id",
          userId,
        );
        return rows.map((row) => ({
          ...row,
          userId: row.userId as UserId,
          lastReviewedAt: new Date(row.lastReviewedAt),
        }));
      },
    },
    workSignals: {
      async create(value) {
        audienceSchema.parse(value.audience);
        await assertSelfD1(value.actorId, value.userId);
        await run(
          DB,
          "INSERT INTO work_signals (id, user_id, taxonomy_version_id, free_text_summary, audience, cohort_scope_id, allow_matching, approved_at, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          value.id,
          value.userId,
          value.taxonomyVersionId,
          value.summary,
          value.audience,
          value.cohortScopeId,
          value.allowMatching ? 1 : 0,
          ms(value.createdAt),
          ms(value.expiresAt),
          ms(value.createdAt),
          ms(value.createdAt),
        );
      },
      async listVisible(subjectUserId, viewerUserId, at) {
        const rows = await all<{
          id: string;
          userId: string;
          taxonomyVersionId: string;
          summary: string;
          audience: WorkSignalRecord["audience"];
          cohortScopeId: string | null;
          allowMatching: number;
          expiresAt: number;
          createdAt: number;
        }>(
          DB,
          `SELECT w.id, w.user_id AS userId, w.taxonomy_version_id AS taxonomyVersionId, w.free_text_summary AS summary, w.audience, w.cohort_scope_id AS cohortScopeId, w.allow_matching AS allowMatching, w.expires_at AS expiresAt, w.created_at AS createdAt FROM work_signals w WHERE w.user_id=? AND w.expires_at>? AND w.revoked_at IS NULL AND ${audiencePredicate("w")} ORDER BY w.created_at DESC`,
          subjectUserId,
          ms(at),
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
        );
        return rows.map(workSignal);
      },
    },
    taxonomy: {
      async createVersion(input) {
        await run(
          DB,
          "INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES (?,?,?,?,?)",
          input.id,
          input.version,
          input.status,
          ms(input.at),
          input.status === "active" ? ms(input.at) : null,
        );
      },
      async createTopic(input) {
        await run(
          DB,
          "INSERT INTO topics (id,taxonomy_version_id,slug,label) VALUES (?,?,?,?)",
          input.id,
          input.taxonomyVersionId,
          input.slug,
          input.label,
        );
      },
    },
    projects: {
      async create(value) {
        audienceSchema.parse(value.audience);
        await assertSelfD1(value.actorId, value.ownerUserId);
        await run(
          DB,
          "INSERT INTO projects (id, owner_user_id, slug, title, summary, audience, cohort_scope_id, allow_matching, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          value.id,
          value.ownerUserId,
          value.slug,
          value.title,
          value.summary,
          value.audience,
          value.cohortScopeId,
          value.allowMatching ? 1 : 0,
          value.status,
          ms(value.createdAt),
          ms(value.createdAt),
        );
      },
      async findVisible(id, viewerUserId) {
        const row = await first<{
          id: string;
          ownerUserId: string;
          slug: string;
          title: string;
          summary: string;
          audience: ProjectRecord["audience"];
          cohortScopeId: string | null;
          allowMatching: number;
          status: ProjectRecord["status"];
          createdAt: number;
        }>(
          DB,
          `SELECT x.id, x.owner_user_id AS ownerUserId, x.slug, x.title, x.summary, x.audience, x.cohort_scope_id AS cohortScopeId, x.allow_matching AS allowMatching, x.status, x.created_at AS createdAt FROM projects x WHERE x.id=? AND x.status<>'deleted' AND (EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id=x.id AND pc.user_id=? AND pc.approved_at IS NOT NULL) OR ${audiencePredicate("x", "owner_user_id")}) LIMIT 1`,
          id,
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
          viewerUserId ?? "",
        );
        return row ? project(row) : null;
      },
      async setCollaborator(input) {
        const owner = await first(
          DB,
          "SELECT 1 AS ok FROM projects WHERE id=? AND owner_user_id=? AND status<>'deleted'",
          input.projectId,
          input.actorId,
        );
        if (!owner) throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO project_collaborators (project_id,user_id,role,approved_at) VALUES (?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,approved_at=excluded.approved_at",
          input.projectId,
          input.userId,
          input.role,
          input.approvedAt ? ms(input.approvedAt) : null,
        );
      },
      async getCollaboratorRole(projectId, userId) {
        const row = await first<{ role: "viewer" | "editor" | "owner" }>(
          DB,
          "SELECT role FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL",
          projectId,
          userId,
        );
        return row?.role ?? null;
      },
      async canEdit(projectId, actorId) {
        return Boolean(
          await first(
            DB,
            "SELECT 1 AS ok FROM projects p WHERE p.id=? AND p.status<>'deleted' AND (p.owner_user_id=? OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id=p.id AND pc.user_id=? AND pc.approved_at IS NOT NULL AND pc.role IN ('editor','owner'))) LIMIT 1",
            projectId,
            actorId,
            actorId,
          ),
        );
      },
    },
    networking: {
      async savePulse(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO networking_pulses (id,user_id,intent_summary,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?)",
          input.id,
          input.userId,
          input.intentSummary,
          ms(input.startsAt),
          ms(input.expiresAt),
          ms(input.at),
        );
      },
      async setBudget(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO introduction_budgets (user_id,maximum_per_week,used_this_week,week_started_at) VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET maximum_per_week=excluded.maximum_per_week,week_started_at=excluded.week_started_at",
          input.userId,
          input.maximumPerWeek,
          ms(input.weekStartedAt),
        );
      },
      async addQuietHours(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO quiet_hours (id,user_id,timezone,weekday,start_minute,end_minute) VALUES (?,?,?,?,?,?)",
          input.id,
          input.userId,
          input.timezone,
          input.weekday,
          input.startMinute,
          input.endMinute,
        );
      },
      async snooze(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO matching_snoozes (id,user_id,starts_at,ends_at,created_at) VALUES (?,?,?,?,?)",
          input.id,
          input.userId,
          ms(input.startsAt),
          ms(input.endsAt),
          ms(input.at),
        );
      },
      async exclude(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO matching_exclusions (id,user_id,kind,normalized_value,created_at) VALUES (?,?,?,?,?)",
          input.id,
          input.userId,
          input.kind,
          input.normalizedValue,
          ms(input.at),
        );
      },
      async watch(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO watches (id,user_id,kind,target_id,created_at) VALUES (?,?,?,?,?)",
          input.id,
          input.userId,
          input.kind,
          input.targetId,
          ms(input.at),
        );
      },
      async follow(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO follows (follower_user_id,target_kind,target_id,created_at) VALUES (?,?,?,?)",
          input.userId,
          input.targetKind,
          input.targetId,
          ms(input.at),
        );
      },
    },
    invites: {
      async createLink(value) {
        await assertSelfD1(value.actorId, value.creatorUserId);
        await run(
          DB,
          "INSERT INTO invite_links (id, creator_user_id, kind, token_hash, maximum_uses, use_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
          value.id,
          value.creatorUserId,
          value.kind,
          value.tokenHash,
          value.maximumUses,
          ms(value.expiresAt),
          ms(value.createdAt),
        );
      },
      async consumeLink(tokenHash, at) {
        return changed(
          await execute(
            DB,
            "UPDATE invite_links SET use_count=use_count+1 WHERE token_hash=? AND revoked_at IS NULL AND expires_at>? AND use_count<maximum_uses",
            tokenHash,
            ms(at),
          ),
        );
      },
      async createConnectionCard(value) {
        await assertSelfD1(value.actorId, value.creatorUserId);
        if (
          value.projectId &&
          !(await repository.projects.canEdit(value.projectId, value.actorId))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO connection_cards (id, creator_user_id, project_id, headline, token_hash, maximum_uses, use_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)",
          value.id,
          value.creatorUserId,
          value.projectId,
          value.headline,
          value.tokenHash,
          value.maximumUses,
          ms(value.expiresAt),
          ms(value.createdAt),
        );
      },
      async consumeConnectionCard(tokenHash, at) {
        const row = await first<{
          id: string;
          creatorUserId: string;
          projectId: string | null;
          headline: string;
        }>(
          DB,
          "UPDATE connection_cards SET use_count=use_count+1 WHERE token_hash=? AND status='active' AND revoked_at IS NULL AND expires_at>? AND use_count<maximum_uses RETURNING id,creator_user_id AS creatorUserId,project_id AS projectId,headline",
          tokenHash,
          ms(at),
        );
        return row
          ? {
              ...row,
              creatorUserId: row.creatorUserId as UserId,
              projectId: row.projectId as ProjectId | null,
            }
          : null;
      },
    },
    cohorts: {
      async create(cohort) {
        if (!(await repository.users.findById(cohort.actorId)))
          throw new Error("forbidden");
        const now = Date.now();
        await batch(DB, [
          [
            "INSERT INTO cohorts (id, slug, name, description, visibility, community_created, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)",
            cohort.id,
            cohort.slug,
            cohort.name,
            cohort.description,
            cohort.visibility,
            cohort.communityCreated ? 1 : 0,
            now,
            now,
          ],
          [
            "INSERT INTO cohort_memberships (cohort_id,user_id,role,status,joined_at) VALUES (?,?,'owner','active',?)",
            cohort.id,
            cohort.actorId,
            now,
          ],
        ]);
      },
      async findByIdForViewer(id, viewerUserId) {
        const row = await first<{
          id: string;
          slug: string;
          name: string;
          description: string;
          visibility: Cohort["visibility"];
          communityCreated: number;
        }>(
          DB,
          "SELECT c.id,c.slug,c.name,c.description,c.visibility,c.community_created AS communityCreated FROM cohorts c WHERE c.id=? AND c.status<>'deleted' AND (c.visibility='public' OR EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.cohort_id=c.id AND cm.user_id=? AND cm.status='active')) LIMIT 1",
          id,
          viewerUserId ?? "",
        );
        return row
          ? {
              ...row,
              id: row.id as CohortId,
              communityCreated: Boolean(row.communityCreated),
            }
          : null;
      },
      async setMembership(input) {
        const actor = await first<{
          role: "member" | "admin" | "owner";
          status: string;
        }>(
          DB,
          "SELECT role,status FROM cohort_memberships WHERE cohort_id=? AND user_id=?",
          input.cohortId,
          input.actorId,
        );
        const current = await first<{ role: "member" | "admin" | "owner" }>(
          DB,
          "SELECT role FROM cohort_memberships WHERE cohort_id=? AND user_id=?",
          input.cohortId,
          input.userId,
        );
        if (input.role === "owner" || current?.role === "owner")
          throw new Error("ownership_transfer_required");
        const selfExit =
          input.actorId === input.userId &&
          (input.status === "requested" ||
            input.status === "declined" ||
            input.status === "left");
        if (!selfExit && !(actor?.status === "active" && isAdmin(actor.role)))
          throw new Error("forbidden");
        if (selfExit && input.status === "requested" && input.role !== "member")
          throw new Error("forbidden");
        if (
          selfExit &&
          input.status !== "requested" &&
          current &&
          current.role !== input.role
        )
          throw new Error("forbidden");
        const role = selfExit && current ? current.role : input.role;
        await run(
          DB,
          "INSERT INTO cohort_memberships (cohort_id, user_id, role, status, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cohort_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,joined_at=excluded.joined_at",
          input.cohortId,
          input.userId,
          role,
          input.status,
          input.status === "active" ? Date.now() : null,
        );
      },
      async transferOwnership(input) {
        if (input.actorId === input.newOwnerUserId)
          throw new Error("ownership_conflict");
        const result = await execute(
          DB,
          "UPDATE cohort_memberships SET role=CASE WHEN user_id=? THEN 'owner' ELSE ? END WHERE cohort_id=? AND user_id IN (?,?) AND status='active' AND (SELECT COUNT(*) FROM cohort_memberships WHERE cohort_id=? AND status='active' AND role='owner')=1 AND EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id=? AND user_id=? AND status='active' AND role='owner') AND EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id=? AND user_id=? AND status='active' AND role<>'owner')",
          input.newOwnerUserId,
          input.demoteOldOwnerTo,
          input.cohortId,
          input.actorId,
          input.newOwnerUserId,
          input.cohortId,
          input.cohortId,
          input.actorId,
          input.cohortId,
          input.newOwnerUserId,
        );
        if (Number(result.meta?.changes ?? 0) !== 2)
          throw new Error("ownership_conflict");
      },
      async getActiveRole(cohortId, userId) {
        const row = await first<{ role: "member" | "admin" | "owner" }>(
          DB,
          "SELECT role FROM cohort_memberships WHERE cohort_id=? AND user_id=? AND status='active' LIMIT 1",
          cohortId,
          userId,
        );
        return row?.role ?? null;
      },
      async createInvitation(input) {
        if (
          input.actorId !== input.inviterUserId ||
          !isAdmin(
            await repository.cohorts.getActiveRole(
              input.cohortId,
              input.actorId,
            ),
          )
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO cohort_invitations (id, cohort_id, inviter_user_id, invitee_user_id, token_hash, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
          input.id,
          input.cohortId,
          input.inviterUserId,
          input.inviteeUserId,
          input.tokenHash,
          ms(input.expiresAt),
          ms(input.createdAt),
        );
      },
      async respondToInvitation(id, actorId, decision, at) {
        const candidate = await first<{ cohortId: string }>(
          DB,
          "SELECT cohort_id AS cohortId FROM cohort_invitations WHERE id=? AND invitee_user_id=? AND status='pending' AND expires_at>?",
          id,
          actorId,
          ms(at),
        );
        if (!candidate) return null;
        const statements: [string, ...unknown[]][] = [
          [
            "UPDATE cohort_invitations SET status=?,responded_at=? WHERE id=? AND invitee_user_id=? AND status='pending' AND expires_at>?",
            decision,
            ms(at),
            id,
            actorId,
            ms(at),
          ],
        ];
        if (decision === "accepted")
          statements.push([
            "INSERT INTO cohort_memberships (cohort_id,user_id,role,status,joined_at) SELECT cohort_id,invitee_user_id,'member','active',? FROM cohort_invitations WHERE id=? AND status='accepted' AND responded_at=? ON CONFLICT(cohort_id,user_id) DO UPDATE SET role=cohort_memberships.role,status='active',joined_at=excluded.joined_at",
            ms(at),
            id,
            ms(at),
          ]);
        const results = await executeBatch(DB, statements);
        return Number(results[0].meta?.changes ?? 0) === 1
          ? {
              cohortId: candidate.cohortId as CohortId,
              membershipActivated: decision === "accepted",
            }
          : null;
      },
    },
    surfaces: {
      async createPolicy(input) {
        const existing = await first<{ id: string; version: string; sourceHash: string; policyJson: string; activatedAt: number | null }>(
          DB,
          "SELECT id,version,source_hash AS sourceHash,policy_json AS policyJson,activated_at AS activatedAt FROM design_policies WHERE id=? OR version=? OR source_hash=? LIMIT 1",
          input.id,
          input.version,
          input.sourceHash,
        );
        if (existing) {
          if (
            existing.id === input.id && existing.version === input.version && existing.sourceHash === input.sourceHash &&
            existing.policyJson === input.policyJson && existing.activatedAt === ms(input.activatedAt)
          ) return;
          throw new Error("policy_conflict");
        }
        await run(
          DB,
          "INSERT INTO design_policies (id, version, source_hash, policy_json, activated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          input.id,
          input.version,
          input.sourceHash,
          input.policyJson,
          ms(input.activatedAt),
          ms(input.at),
        );
      },
      async createSurface(input) {
        if (
          input.actorId !== input.ownerUserId ||
          !(await canOwnSurfaceSubject(
            input.kind,
            input.subjectId,
            input.ownerUserId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO surfaces (id, owner_user_id, kind, subject_id, governance_version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
          input.id,
          input.ownerUserId,
          input.kind,
          input.subjectId,
          ms(input.at),
          ms(input.at),
        );
      },
      async createRevision(value) {
        if (
          value.actorId !== value.authorUserId ||
          !(await surfaceAuthority(value.surfaceId, value.actorId, "member"))
        )
          throw new Error("forbidden");
        const dependency = await first<{ kind: "profile" | "room" | "circle"; policyId: string; policyVersion: string; policySourceHash: string; policyJson: string; activatedAt: number }>(DB,
          "SELECT s.kind,p.id AS policyId,p.version AS policyVersion,p.source_hash AS policySourceHash,p.policy_json AS policyJson,p.activated_at AS activatedAt FROM surfaces s JOIN design_policies p ON p.id=? WHERE s.id=?",
          value.designPolicyId, value.surfaceId,
        );
        if (!dependency || dependency.activatedAt > ms(value.createdAt)) throw new Error("surface_dependency_missing");
        if (!isSurfacePolicyCompatible({ id: dependency.policyId, version: dependency.policyVersion, sourceHash: dependency.policySourceHash, policyJson: dependency.policyJson }, { forRevisionCreation: true })) throw new Error("surface_revision_policy_mismatch");
        const parsedSpec = parseRevisionSpec(value.specJson, dependency.policyVersion, true);
        if (parsedSpec.kind !== dependency.kind || parsedSpec.designPolicyVersion !== dependency.policyVersion || value.designPolicyVersion !== dependency.policyVersion) throw new Error("surface_revision_policy_mismatch");
        const current = await currentSurfaceRevisionNumber(value.surfaceId);
        if (value.baseRevisionNumber !== current)
          throw new Error("stale_surface_base");
        await run(
          DB,
          "INSERT INTO surface_revisions (id, surface_id, revision_number, base_revision_number, author_user_id, design_policy_id, design_policy_version, spec_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)",
          value.id,
          value.surfaceId,
          value.revisionNumber,
          value.baseRevisionNumber,
          value.authorUserId,
          value.designPolicyId,
          value.designPolicyVersion,
          value.specJson,
          ms(value.createdAt),
        );
      },
      async findRevisionForViewer(id, viewerUserId) {
        const row = await first<{
          id: string;
          surfaceId: string;
          authorUserId: string;
          revisionNumber: number;
          baseRevisionNumber: number | null;
          designPolicyId: string;
          designPolicyVersion: string;
          specJson: string;
          createdAt: number;
          ownerUserId: string;
          kind: "profile" | "room" | "circle";
          subjectId: string;
          status: string;
          publishedRevisionId: string | null;
          policyVersion: string;
          policySourceHash: string;
          policyJson: string;
        }>(
          DB,
          "SELECT r.id,r.surface_id AS surfaceId,r.author_user_id AS authorUserId,r.revision_number AS revisionNumber,r.base_revision_number AS baseRevisionNumber,r.design_policy_id AS designPolicyId,r.design_policy_version AS designPolicyVersion,r.spec_json AS specJson,r.created_at AS createdAt,r.status,s.owner_user_id AS ownerUserId,s.kind,s.subject_id AS subjectId,s.published_revision_id AS publishedRevisionId,p.version AS policyVersion,p.source_hash AS policySourceHash,p.policy_json AS policyJson FROM surface_revisions r JOIN surfaces s ON s.id=r.surface_id JOIN design_policies p ON p.id=r.design_policy_id WHERE r.id=?",
          id,
        );
        if (!row) return null;
        try {
          if (!isSurfacePolicyCompatible({ id: row.designPolicyId, version: row.policyVersion, sourceHash: row.policySourceHash, policyJson: row.policyJson })) return null;
          const parsed = parseRevisionSpec(row.specJson, row.policyVersion);
          if (row.designPolicyVersion !== row.policyVersion || parsed.kind !== row.kind) return null;
        } catch { return null; }
        if (
          viewerUserId &&
          (row.ownerUserId === viewerUserId ||
            row.authorUserId === viewerUserId) &&
          (await surfaceAuthority(row.surfaceId, viewerUserId, "member"))
        )
          return surfaceRevision(row);
        if (row.status !== "published" || row.publishedRevisionId !== row.id)
          return null;
        const allowed =
          row.kind === "profile"
            ? Boolean(
                await repository.profiles.findByIdForViewer(
                  row.subjectId as ProfileId,
                  viewerUserId,
                ),
              )
            : row.kind === "room"
              ? Boolean(
                  viewerUserId &&
                  (await repository.rooms.isActiveMember(
                    row.subjectId as RoomId,
                    viewerUserId,
                  )),
                )
              : Boolean(
                  await repository.circles.getActiveRole(
                    row.subjectId as import("@buildmates/domain").CircleId,
                    viewerUserId,
                  ),
                );
        return allowed ? surfaceRevision(row) : null;
      },
      async decideRevision(input) {
        const revision = await first<{
          surfaceId: string;
          baseRevisionNumber: number | null;
          governanceVersion: number;
        }>(
          DB,
          "SELECT r.surface_id AS surfaceId,r.base_revision_number AS baseRevisionNumber,s.governance_version AS governanceVersion FROM surface_revisions r JOIN surfaces s ON s.id=r.surface_id WHERE r.id=?",
          input.revisionId,
        );
        if (
          !revision ||
          revision.baseRevisionNumber !==
            (await currentSurfaceRevisionNumber(revision.surfaceId)) ||
          input.governanceVersion !== revision.governanceVersion ||
          !(await surfaceAuthority(revision.surfaceId, input.actorId, "member"))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO surface_approvals (revision_id,user_id,governance_version,decision,decided_at) VALUES (?,?,?,?,?) ON CONFLICT(revision_id,user_id) DO UPDATE SET governance_version=excluded.governance_version,decision=excluded.decision,decided_at=excluded.decided_at",
          input.revisionId,
          input.actorId,
          input.governanceVersion,
          input.decision,
          ms(input.at),
        );
      },
      async publishRevision(input) {
        const state = await surfacePublishState(
          input.surfaceId,
          input.revisionId,
        );
        if (!state) throw new Error("surface_conflict");

        let authoritySql: string;
        let authorityValues: unknown[];
        let publishProposal = false;
        if (state.kind === "profile") {
          authoritySql = "s.owner_user_id=?";
          authorityValues = [input.actorId];
        } else if (state.kind === "room") {
          authoritySql =
            "EXISTS (SELECT 1 FROM rooms r JOIN room_memberships actor_rm ON actor_rm.room_id=r.id AND actor_rm.user_id=? AND actor_rm.left_at IS NULL WHERE r.id=s.subject_id AND r.status='active') AND NOT EXISTS (SELECT 1 FROM room_memberships blocked_rm JOIN blocks b ON b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=blocked_rm.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=blocked_rm.user_id)) WHERE blocked_rm.room_id=s.subject_id AND blocked_rm.left_at IS NULL AND blocked_rm.user_id<>?) AND NOT EXISTS (SELECT 1 FROM room_memberships rm WHERE rm.room_id=s.subject_id AND rm.left_at IS NULL AND NOT EXISTS (SELECT 1 FROM surface_approvals a WHERE a.revision_id=? AND a.user_id=rm.user_id AND a.governance_version=s.governance_version AND a.decision='approved'))";
          authorityValues = [
            input.actorId,
            input.actorId,
            input.actorId,
            input.actorId,
            input.revisionId,
          ];
        } else {
          const circle = await first<{ governanceMode: "admin" | "vote" }>(
            DB,
            "SELECT governance_mode AS governanceMode FROM circles WHERE id=?",
            state.subjectId,
          );
          if (!circle) throw new Error("forbidden");
          if (circle.governanceMode === "admin") {
            authoritySql =
              "EXISTS (SELECT 1 FROM circles c JOIN circle_memberships cm ON cm.circle_id=c.id AND cm.user_id=? AND cm.status='active' AND cm.role IN ('admin','owner') WHERE c.id=s.subject_id AND c.status='active' AND c.governance_mode='admin' AND c.governance_version=s.governance_version) AND NOT EXISTS (SELECT 1 FROM circle_memberships blocked_cm JOIN blocks b ON b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=blocked_cm.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=blocked_cm.user_id)) WHERE blocked_cm.circle_id=s.subject_id AND blocked_cm.status='active' AND blocked_cm.user_id<>?)";
            authorityValues = [
              input.actorId,
              input.actorId,
              input.actorId,
              input.actorId,
            ];
          } else {
            if (!input.proposalId) throw new Error("proposal_required");
            publishProposal = true;
            authoritySql =
              "EXISTS (SELECT 1 FROM circles c JOIN circle_memberships actor_cm ON actor_cm.circle_id=c.id AND actor_cm.user_id=? AND actor_cm.status='active' JOIN circle_proposals cp ON cp.id=? AND cp.circle_id=c.id AND cp.kind='design' AND cp.governance_version=c.governance_version AND cp.status='approved' WHERE c.id=s.subject_id AND c.status='active' AND c.governance_mode='vote' AND c.governance_version=s.governance_version AND json_extract(cp.payload_json,'$.revisionId')=? AND NOT EXISTS (SELECT 1 FROM circle_memberships blocked_cm JOIN blocks b ON b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=blocked_cm.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=blocked_cm.user_id)) WHERE blocked_cm.circle_id=c.id AND blocked_cm.status='active' AND blocked_cm.user_id<>?) AND (SELECT COUNT(*) FROM circle_votes v JOIN circle_memberships voters ON voters.circle_id=c.id AND voters.user_id=v.user_id AND voters.status='active' WHERE v.proposal_id=cp.id AND v.vote='approve') > (SELECT COUNT(*) FROM circle_memberships active_cm WHERE active_cm.circle_id=c.id AND active_cm.status='active') / 2.0)";
            authorityValues = [
              input.actorId,
              input.proposalId,
              input.revisionId,
              input.actorId,
              input.actorId,
              input.actorId,
            ];
          }
        }

        const statements: [string, ...unknown[]][] = [
          [
            `UPDATE surfaces AS s SET published_revision_id=?,updated_at=? WHERE s.id=? AND s.governance_version=? AND COALESCE((SELECT current.revision_number FROM surface_revisions current WHERE current.id=s.published_revision_id AND current.surface_id=s.id),-1)=COALESCE(?,-1) AND EXISTS (SELECT 1 FROM surface_revisions target WHERE target.id=? AND target.surface_id=s.id AND target.base_revision_number IS ?) AND ${authoritySql}`,
            input.revisionId,
            ms(input.at),
            input.surfaceId,
            input.governanceVersion,
            input.expectedPublishedRevisionNumber,
            input.revisionId,
            input.expectedPublishedRevisionNumber,
            ...authorityValues,
          ],
          [
            "UPDATE surface_revisions SET status='published' WHERE id=? AND surface_id=? AND EXISTS (SELECT 1 FROM surfaces s WHERE s.id=? AND s.published_revision_id=?)",
            input.revisionId,
            input.surfaceId,
            input.surfaceId,
            input.revisionId,
          ],
        ];
        if (publishProposal) {
          statements.push([
            "UPDATE circle_proposals SET status='published' WHERE id=? AND status='approved' AND EXISTS (SELECT 1 FROM surfaces s WHERE s.id=? AND s.published_revision_id=?)",
            input.proposalId,
            input.surfaceId,
            input.revisionId,
          ]);
        }
        const results = await executeBatch(DB, statements);
        if (results.some((result) => !changed(result)))
          throw new Error("surface_conflict");
      },
      async setPersonalView(input) {
        if (
          !(await surfaceAuthority(input.surfaceId, input.actorId, "member")) ||
          !(await first(
            DB,
            "SELECT 1 AS ok FROM surface_revisions WHERE id=? AND surface_id=?",
            input.revisionId,
            input.surfaceId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO personal_surface_views (id,surface_id,user_id,revision_id,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(surface_id,user_id) DO UPDATE SET revision_id=excluded.revision_id,updated_at=excluded.updated_at",
          input.id,
          input.surfaceId,
          input.actorId,
          input.revisionId,
          ms(input.at),
          ms(input.at),
        );
      },
      async addAsset(input) {
        await assertSelfD1(input.actorId, input.ownerUserId);
        await run(
          DB,
          "INSERT INTO surface_assets (id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES (?,?,?,?,?,?,?)",
          input.id,
          input.ownerUserId,
          input.objectKey,
          input.contentType,
          input.byteSize,
          input.sha256,
          ms(input.at),
        );
      },
    },
    matching: {
      async upsertBuilderIndex(input) {
        await assertSelfD1(input.actorId, input.userId);
        const result = await execute(
          DB,
          "INSERT INTO builder_match_index (user_id,version,taxonomy_version_id,topics_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,taxonomy_version_id=excluded.taxonomy_version_id,topics_json=excluded.topics_json,updated_at=excluded.updated_at WHERE excluded.version>builder_match_index.version",
          input.userId,
          input.version,
          input.taxonomyVersionId,
          input.topicsJson,
          ms(input.at),
        );
        if (!changed(result)) throw new Error("stale_index_version");
      },
      async recordPairScore(input) {
        await run(
          DB,
          "INSERT INTO pair_scores (id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at) VALUES (?,?,?,?,?,?,?,'{}','[]','[]',?,?,?)",
          input.id,
          input.userAId,
          input.userBId,
          input.indexVersionA,
          input.indexVersionB,
          input.taxonomyVersion,
          input.weightVersion,
          input.totalBasisPoints,
          ms(input.expiresAt),
          ms(input.at),
        );
      },
      async createCandidateBatch(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO candidate_batches (id,user_id,index_version,taxonomy_version,candidate_ids_json,expires_at,created_at) VALUES (?,?,?,?,?,?,?)",
          input.id,
          input.userId,
          input.indexVersion,
          input.taxonomyVersion,
          input.candidateIdsJson,
          ms(input.expiresAt),
          ms(input.at),
        );
      },
      async createPair(value) {
        await run(
          DB,
          "INSERT INTO match_pairs (id, user_a_id, user_b_id, created_at) VALUES (?, ?, ?, ?)",
          value.id,
          value.userAId,
          value.userBId,
          ms(value.createdAt),
        );
      },
      async findPair(id) {
        const row = await first<{
          id: string;
          userAId: string;
          userBId: string;
          createdAt: number;
        }>(
          DB,
          "SELECT id,user_a_id AS userAId,user_b_id AS userBId,created_at AS createdAt FROM match_pairs WHERE id=?",
          id,
        );
        return row
          ? {
              ...row,
              userAId: row.userAId as UserId,
              userBId: row.userBId as UserId,
              createdAt: new Date(row.createdAt),
            }
          : null;
      },
      async recordEvaluation(input) {
        await assertSelfD1(input.actorId, input.userId);
        if (!(await proposalMember(input.proposalId, input.userId)))
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO codex_evaluations (id,proposal_id,user_id,decision,reason_summary,index_version,created_at) VALUES (?,?,?,?,?,?,?)",
          input.id,
          input.proposalId,
          input.userId,
          input.decision,
          input.reasonSummary,
          input.indexVersion,
          ms(input.at),
        );
      },
      async recordHumanResponse(input) {
        await assertSelfD1(input.actorId, input.userId);
        if (!(await proposalMember(input.proposalId, input.userId)))
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO human_responses (id,proposal_id,user_id,response,created_at) VALUES (?,?,?,?,?)",
          input.id,
          input.proposalId,
          input.userId,
          input.response,
          ms(input.at),
        );
      },
      async recordMatchedProposal(input) {
        await batch(DB, [
          [
            "INSERT INTO match_proposals (id, match_pair_id, attempt_number, evidence_version_a, evidence_version_b, acceptance_mode_a, acceptance_mode_b, explanation_a_json, explanation_b_json, state, expires_at, terminal_at, created_at) VALUES (?, ?, 1, 1, 1, ?, ?, '{}', '{}', 'matched', ?, ?, ?)",
            input.proposalId,
            input.pairId,
            input.acceptanceModeA,
            input.acceptanceModeB,
            ms(input.expiresAt),
            ms(input.at),
            ms(input.at),
          ],
          [
            "INSERT INTO matches (id, match_pair_id, proposal_id, matched_at) VALUES (?, ?, ?, ?)",
            input.matchId,
            input.pairId,
            input.proposalId,
            ms(input.at),
          ],
        ]);
      },
    },
    connections: {
      async createFromMatch(input) {
        const now = ms(input.at);
        const results = await executeBatch(DB, [
          [
            "INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) SELECT ?,m.match_pair_id,m.id,'active',?,? FROM matches m JOIN match_proposals p ON p.id=m.proposal_id AND p.match_pair_id=m.match_pair_id WHERE m.id=? AND m.match_pair_id=? AND p.state='matched' AND NOT EXISTS (SELECT 1 FROM connections c WHERE c.match_pair_id=m.match_pair_id OR c.match_id=m.id)",
            input.id,
            now,
            now,
            input.matchId,
            input.expectedMatchPairId,
          ],
          [
            "INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) SELECT ?,mp.user_a_id,0,1,?,? FROM connections c JOIN match_pairs mp ON mp.id=c.match_pair_id WHERE c.id=?",
            input.id,
            now,
            now,
            input.id,
          ],
          [
            "INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) SELECT ?,mp.user_b_id,0,1,?,? FROM connections c JOIN match_pairs mp ON mp.id=c.match_pair_id WHERE c.id=?",
            input.id,
            now,
            now,
            input.id,
          ],
        ]);
        if (results.some((result) => Number(result.meta?.changes ?? 0) !== 1))
          throw new Error("connection_conflict");
        const value = await first<{
          id: string;
          matchPairId: string;
          matchId: string;
          state: ConnectionRecord["state"];
          createdAt: number;
        }>(
          DB,
          "SELECT id,match_pair_id AS matchPairId,match_id AS matchId,state,created_at AS createdAt FROM connections WHERE id=?",
          input.id,
        );
        if (!value) throw new Error("connection_conflict");
        return {
          ...value,
          id: value.id as ConnectionId,
          createdAt: new Date(value.createdAt),
        };
      },
      async findForMember(id, actorUserId) {
        const row = await first<{
          id: string;
          matchPairId: string;
          matchId: string;
          state: ConnectionRecord["state"];
          createdAt: number;
        }>(
          DB,
          "SELECT c.id,c.match_pair_id AS matchPairId,c.match_id AS matchId,c.state,c.created_at AS createdAt FROM connections c JOIN connection_sides s ON s.connection_id=c.id WHERE c.id=? AND s.user_id=? LIMIT 1",
          id,
          actorUserId,
        );
        return row
          ? {
              ...row,
              id: row.id as ConnectionId,
              createdAt: new Date(row.createdAt),
            }
          : null;
      },
      async updateSide(input) {
        await assertSelfD1(input.actorId, input.userId);
        if (
          !changed(
            await execute(
              DB,
              "UPDATE connection_sides SET muted=?,renewed_relevance_enabled=?,updated_at=? WHERE connection_id=? AND user_id=?",
              input.muted ? 1 : 0,
              input.renewedRelevanceEnabled ? 1 : 0,
              ms(input.at),
              input.connectionId,
              input.userId,
            ),
          )
        )
          throw new Error("forbidden");
      },
      async savePrivateNote(input) {
        await assertSelfD1(input.actorId, input.ownerUserId);
        if (
          !(await repository.connections.findForMember(
            input.connectionId,
            input.ownerUserId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO connection_private_notes (id,connection_id,owner_user_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
          input.id,
          input.connectionId,
          input.ownerUserId,
          input.body,
          ms(input.at),
          ms(input.at),
        );
      },
      async readPrivateNote(id, ownerUserId) {
        const row = await first<{ body: string }>(
          DB,
          "SELECT body FROM connection_private_notes WHERE id=? AND owner_user_id=?",
          id,
          ownerUserId,
        );
        return row?.body ?? null;
      },
      async scheduleReminder(input) {
        await assertSelfD1(input.actorId, input.userId);
        if (
          !(await repository.connections.findForMember(
            input.connectionId,
            input.userId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO connection_reminders (id,connection_id,user_id,remind_at,status,created_at) VALUES (?,?,?,?,'scheduled',?)",
          input.id,
          input.connectionId,
          input.userId,
          ms(input.remindAt),
          ms(input.at),
        );
      },
      async setUpdateSubscription(input) {
        await assertSelfD1(input.actorId, input.subscriberUserId);
        if (
          !(await repository.connections.findForMember(
            input.connectionId,
            input.subscriberUserId,
          )) ||
          !(await repository.connections.findForMember(
            input.connectionId,
            input.subjectUserId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO connection_update_subscriptions (connection_id,subscriber_user_id,subject_user_id,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(connection_id,subscriber_user_id) DO UPDATE SET subject_user_id=excluded.subject_user_id,enabled=excluded.enabled,updated_at=excluded.updated_at",
          input.connectionId,
          input.subscriberUserId,
          input.subjectUserId,
          input.enabled ? 1 : 0,
          ms(input.at),
          ms(input.at),
        );
      },
      async requestReconnect(input) {
        await assertSelfD1(input.actorId, input.requesterUserId);
        if (
          !(await repository.connections.findForMember(
            input.connectionId,
            input.requesterUserId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO reconnect_requests (id,connection_id,requester_user_id,response,created_at) VALUES (?,?,?,'pending',?)",
          input.id,
          input.connectionId,
          input.requesterUserId,
          ms(input.at),
        );
      },
    },
    rooms: {
      async createForConnection(input) {
        const now = ms(input.at);
        const results = await executeBatch(DB, [
          [
            "INSERT INTO rooms (id,match_pair_id,connection_id,status,created_at,updated_at) SELECT ?,c.match_pair_id,c.id,'active',?,? FROM connections c JOIN matches m ON m.id=c.match_id AND m.match_pair_id=c.match_pair_id JOIN match_pairs mp ON mp.id=c.match_pair_id WHERE c.id=? AND c.match_pair_id=? AND c.state='active' AND (SELECT COUNT(*) FROM connection_sides cs WHERE cs.connection_id=c.id)=2 AND (SELECT COUNT(*) FROM connection_sides cs WHERE cs.connection_id=c.id AND cs.user_id IN (mp.user_a_id,mp.user_b_id))=2 AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.match_pair_id=c.match_pair_id OR r.connection_id=c.id)",
            input.id,
            now,
            now,
            input.connectionId,
            input.expectedMatchPairId,
          ],
          [
            "INSERT INTO room_memberships (room_id,user_id,joined_at) SELECT ?,cs.user_id,? FROM connection_sides cs WHERE cs.connection_id=?",
            input.id,
            now,
            input.connectionId,
          ],
        ]);
        if (
          Number(results[0].meta?.changes ?? 0) !== 1 ||
          Number(results[1].meta?.changes ?? 0) !== 2
        )
          throw new Error("room_conflict");
      },
      async isActiveMember(id, actorUserId) {
        return Boolean(
          await first(
            DB,
            "SELECT 1 AS ok FROM room_memberships rm JOIN rooms r ON r.id=rm.room_id WHERE rm.room_id=? AND rm.user_id=? AND rm.left_at IS NULL AND r.status='active' AND NOT EXISTS (SELECT 1 FROM room_memberships other JOIN blocks b ON b.revoked_at IS NULL AND ((b.blocker_user_id=rm.user_id AND b.blocked_user_id=other.user_id) OR (b.blocked_user_id=rm.user_id AND b.blocker_user_id=other.user_id)) WHERE other.room_id=rm.room_id AND other.user_id<>rm.user_id) LIMIT 1",
            id,
            actorUserId,
          ),
        );
      },
      async sendMessage(value) {
        await assertSelfD1(value.actorId, value.senderUserId);
        if (!(await this.isActiveMember(value.roomId, value.senderUserId)))
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES (?,?,?,?,?,?)",
          value.id,
          value.roomId,
          value.senderUserId,
          value.clientMessageId,
          value.body,
          ms(value.createdAt),
        );
      },
      async listMessages(id, actorUserId) {
        if (!(await this.isActiveMember(id, actorUserId))) return [];
        const rows = await all<{
          id: string;
          roomId: string;
          senderUserId: string;
          clientMessageId: string;
          body: string;
          createdAt: number;
        }>(
          DB,
          "SELECT id,room_id AS roomId,sender_user_id AS senderUserId,client_message_id AS clientMessageId,body,created_at AS createdAt FROM messages WHERE room_id=? AND deleted_at IS NULL ORDER BY created_at",
          id,
        );
        return rows.map(message);
      },
      async submitFeedback(input) {
        await assertSelfD1(input.actorId, input.userId);
        if (
          !(await repository.connections.findForMember(
            input.connectionId,
            input.userId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO introduction_feedback (id,connection_id,user_id,useful,reasons_json,created_at) VALUES (?,?,?,?,?,?)",
          input.id,
          input.connectionId,
          input.userId,
          input.useful ? 1 : 0,
          input.reasonsJson,
          ms(input.at),
        );
      },
      async proposeUpgrade(input) {
        await assertSelfD1(input.actorId, input.proposerUserId);
        if (
          !(await repository.rooms.isActiveMember(
            input.roomId,
            input.proposerUserId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO room_upgrade_proposals (id,room_id,proposer_user_id,modules_json,explanation,status,created_at) VALUES (?,?,?,?,?,'proposed',?)",
          input.id,
          input.roomId,
          input.proposerUserId,
          input.modulesJson,
          input.explanation,
          ms(input.at),
        );
      },
    },
    circles: {
      async create(input) {
        if (!(await repository.users.findById(input.actorId)))
          throw new Error("forbidden");
        await batch(DB, [
          [
            "INSERT INTO circles (id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
            input.id,
            input.name,
            input.purpose,
            input.governanceMode,
            ms(input.at),
            ms(input.at),
          ],
          [
            "INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES (?,?,'owner','active',?)",
            input.id,
            input.actorId,
            ms(input.at),
          ],
        ]);
      },
      async setMembership(input) {
        const actor = await first<{
          role: "member" | "admin" | "owner";
          status: string;
        }>(
          DB,
          "SELECT role,status FROM circle_memberships WHERE circle_id=? AND user_id=?",
          input.circleId,
          input.actorId,
        );
        const current = await first<{ role: "member" | "admin" | "owner" }>(
          DB,
          "SELECT role FROM circle_memberships WHERE circle_id=? AND user_id=?",
          input.circleId,
          input.userId,
        );
        if (input.role === "owner" || current?.role === "owner")
          throw new Error("ownership_transfer_required");
        const selfExit =
          input.actorId === input.userId &&
          (input.status === "declined" || input.status === "left");
        if (!selfExit && !(actor?.status === "active" && isAdmin(actor.role)))
          throw new Error("forbidden");
        if (selfExit && current && current.role !== input.role)
          throw new Error("forbidden");
        const role = selfExit && current ? current.role : input.role;
        await run(
          DB,
          "INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES (?,?,?,?,?) ON CONFLICT(circle_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,joined_at=excluded.joined_at",
          input.circleId,
          input.userId,
          role,
          input.status,
          input.status === "active" ? Date.now() : null,
        );
      },
      async transferOwnership(input) {
        if (input.actorId === input.newOwnerUserId)
          throw new Error("ownership_conflict");
        const result = await execute(
          DB,
          "UPDATE circle_memberships SET role=CASE WHEN user_id=? THEN 'owner' ELSE ? END WHERE circle_id=? AND user_id IN (?,?) AND status='active' AND (SELECT COUNT(*) FROM circle_memberships WHERE circle_id=? AND status='active' AND role='owner')=1 AND EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND user_id=? AND status='active' AND role='owner') AND EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND user_id=? AND status='active' AND role<>'owner')",
          input.newOwnerUserId,
          input.demoteOldOwnerTo,
          input.circleId,
          input.actorId,
          input.newOwnerUserId,
          input.circleId,
          input.circleId,
          input.actorId,
          input.circleId,
          input.newOwnerUserId,
        );
        if (Number(result.meta?.changes ?? 0) !== 2)
          throw new Error("ownership_conflict");
      },
      async getActiveRole(id, actorUserId) {
        if (!actorUserId) return null;
        const row = await first<{ role: "member" | "admin" | "owner" }>(
          DB,
          "SELECT cm.role FROM circle_memberships cm WHERE cm.circle_id=? AND cm.user_id=? AND cm.status='active' AND NOT EXISTS (SELECT 1 FROM circle_memberships other JOIN blocks b ON b.revoked_at IS NULL AND ((b.blocker_user_id=cm.user_id AND b.blocked_user_id=other.user_id) OR (b.blocked_user_id=cm.user_id AND b.blocker_user_id=other.user_id)) WHERE other.circle_id=cm.circle_id AND other.status='active' AND other.user_id<>cm.user_id) LIMIT 1",
          id,
          actorUserId,
        );
        return row?.role ?? null;
      },
      async createProposal(input) {
        if (
          !(await repository.circles.getActiveRole(
            input.circleId,
            input.actorId,
          )) ||
          !(await first(
            DB,
            "SELECT 1 AS ok FROM circles WHERE id=? AND governance_version=? AND status='active'",
            input.circleId,
            input.governanceVersion,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO circle_proposals (id,circle_id,proposer_user_id,kind,payload_json,governance_version,status,created_at) VALUES (?,?,?,?,?,?,'voting',?)",
          input.id,
          input.circleId,
          input.actorId,
          input.kind,
          input.payloadJson,
          input.governanceVersion,
          ms(input.at),
        );
      },
      async vote(input) {
        const proposal = await first<{
          circleId: string;
          governanceVersion: number;
        }>(
          DB,
          "SELECT circle_id AS circleId,governance_version AS governanceVersion FROM circle_proposals WHERE id=?",
          input.proposalId,
        );
        if (
          !proposal ||
          !(await repository.circles.getActiveRole(
            proposal.circleId as import("@buildmates/domain").CircleId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        const results = await executeBatch(DB, [
          [
            "INSERT INTO circle_votes (proposal_id,user_id,vote,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM circle_proposals cp JOIN circles c ON c.id=cp.circle_id AND c.status='active' AND c.governance_version=cp.governance_version JOIN circle_memberships cm ON cm.circle_id=c.id AND cm.user_id=? AND cm.status='active' WHERE cp.id=? AND cp.governance_version=?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET vote=excluded.vote,created_at=excluded.created_at",
            input.proposalId,
            input.actorId,
            input.vote,
            ms(input.at),
            input.actorId,
            input.proposalId,
            proposal.governanceVersion,
          ],
          [
            "UPDATE circle_proposals SET status=CASE WHEN status='published' THEN 'published' WHEN (SELECT COUNT(*) FROM circle_votes v JOIN circle_memberships cm ON cm.user_id=v.user_id AND cm.circle_id=circle_proposals.circle_id AND cm.status='active' WHERE v.proposal_id=circle_proposals.id AND v.vote='approve') > (SELECT COUNT(*) FROM circle_memberships cm WHERE cm.circle_id=circle_proposals.circle_id AND cm.status='active') / 2.0 THEN 'approved' ELSE 'voting' END WHERE id=? AND governance_version=(SELECT governance_version FROM circles WHERE id=circle_proposals.circle_id AND status='active') AND EXISTS (SELECT 1 FROM circle_votes committed_vote WHERE committed_vote.proposal_id=circle_proposals.id AND committed_vote.user_id=? AND committed_vote.created_at=?)",
            input.proposalId,
            input.actorId,
            ms(input.at),
          ],
        ]);
        if (results.some((result) => !changed(result)))
          throw new Error("circle_vote_conflict");
      },
      async addModule(input) {
        if (
          !isAdmin(
            await repository.circles.getActiveRole(
              input.circleId,
              input.actorId,
            ),
          )
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO circle_modules (id,circle_id,kind,config_json,rules_version,active,created_at,updated_at) VALUES (?,?,?,?,1,0,?,?)",
          input.id,
          input.circleId,
          input.kind,
          input.configJson,
          ms(input.at),
          ms(input.at),
        );
      },
      async addMetric(input) {
        if (
          !isAdmin(
            await repository.circles.getActiveRole(
              input.circleId,
              input.actorId,
            ),
          )
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO circle_metrics (id,circle_id,name,rule_json,rules_version,ranking_opt_out_allowed,created_at,updated_at) VALUES (?,?,?,?,1,1,?,?)",
          input.id,
          input.circleId,
          input.name,
          input.ruleJson,
          ms(input.at),
          ms(input.at),
        );
      },
      async recordMetric(input) {
        const metric = await first<{ circleId: string }>(
          DB,
          "SELECT circle_id AS circleId FROM circle_metrics WHERE id=?",
          input.metricId,
        );
        if (
          !metric ||
          !(await repository.circles.getActiveRole(
            metric.circleId as import("@buildmates/domain").CircleId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO circle_metric_entries (id,metric_id,user_id,value,period_key,created_at) VALUES (?,?,?,?,?,?)",
          input.id,
          input.metricId,
          input.actorId,
          input.value,
          input.periodKey,
          ms(input.at),
        );
      },
    },
    notifications: {
      async enqueue(value) {
        await run(
          DB,
          "INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,?,?,?,?)",
          value.id,
          value.userId,
          value.kind,
          value.delivery,
          value.payloadJson,
          ms(value.createdAt),
        );
      },
      async listForUser(userId) {
        const rows = await all<{
          id: string;
          userId: string;
          kind: string;
          delivery: NotificationRecord["delivery"];
          payloadJson: string;
          createdAt: number;
        }>(
          DB,
          "SELECT id,user_id AS userId,kind,delivery,payload_json AS payloadJson,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC",
          userId,
        );
        return rows.map((row) => ({
          ...row,
          userId: row.userId as UserId,
          createdAt: new Date(row.createdAt),
        }));
      },
    },
    automation: {
      async checkpoint(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO automation_checkpoints (id,user_id,kind,cursor,state_json,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET cursor=excluded.cursor,state_json=excluded.state_json,updated_at=excluded.updated_at",
          input.id,
          input.userId,
          input.kind,
          input.cursor,
          input.stateJson,
          ms(input.at),
        );
      },
      async getCheckpoint(userId, kind) {
        return first<{ cursor: string | null; stateJson: string }>(
          DB,
          "SELECT cursor,state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind=?",
          userId,
          kind,
        );
      },
    },
    moderation: {
      async createReport(value) {
        await assertSelfD1(value.actorId, value.reporterUserId);
        const at = ms(value.createdAt);
        await run(
          DB,
          "INSERT INTO reports (id,reporter_user_id,target_kind,target_id,reason_code,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
          value.id,
          value.reporterUserId,
          value.targetKind,
          value.targetId,
          value.reasonCode,
          value.status,
          at,
          at,
        );
      },
      async findForReporter(id, reporterUserId) {
        const row = await first<{
          id: string;
          reporterUserId: string;
          targetKind: string;
          targetId: string;
          reasonCode: string;
          status: ReportRecord["status"];
          createdAt: number;
        }>(
          DB,
          "SELECT id,reporter_user_id AS reporterUserId,target_kind AS targetKind,target_id AS targetId,reason_code AS reasonCode,status,created_at AS createdAt FROM reports WHERE id=? AND reporter_user_id=? LIMIT 1",
          id,
          reporterUserId,
        );
        return row ? report(row) : null;
      },
      async openCase(input) {
        if (!(await isOperatorD1(input.actorId))) throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO moderation_cases (id,report_id,assigned_operator_id,status,created_at,updated_at) VALUES (?,?,?,'open',?,?)",
          input.id,
          input.reportId,
          input.actorId,
          ms(input.at),
          ms(input.at),
        );
      },
      async recordAction(input) {
        if (!(await isOperatorD1(input.actorId))) throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO moderation_actions (id,case_id,operator_user_id,action,reason_code,created_at) VALUES (?,?,?,?,?,?)",
          input.id,
          input.caseId,
          input.actorId,
          input.action,
          input.reasonCode,
          ms(input.at),
        );
      },
      async appeal(input) {
        if (
          (await isOperatorD1(input.actorId)) ||
          !(await first(
            DB,
            "SELECT 1 AS ok FROM moderation_cases c JOIN reports r ON r.id=c.report_id WHERE c.id=? AND (r.reporter_user_id=? OR (r.target_kind='user' AND r.target_id=?) OR (r.target_kind='profile' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id=r.target_id AND p.user_id=?)) OR (r.target_kind='project' AND EXISTS (SELECT 1 FROM projects p WHERE p.id=r.target_id AND p.owner_user_id=?)) OR (r.target_kind='work_signal' AND EXISTS (SELECT 1 FROM work_signals w WHERE w.id=r.target_id AND w.user_id=?)))",
            input.caseId,
            input.actorId,
            input.actorId,
            input.actorId,
            input.actorId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO moderation_appeals (id,case_id,appellant_user_id,statement,status,created_at) VALUES (?,?,?,?,'received',?)",
          input.id,
          input.caseId,
          input.actorId,
          input.statement,
          ms(input.at),
        );
      },
      async queueRedaction(input) {
        const table =
          input.sourceKind === "work_signal"
            ? ["work_signals", "user_id"]
            : input.sourceKind === "project"
              ? ["projects", "owner_user_id"]
              : input.sourceKind === "profile"
                ? ["profiles", "user_id"]
                : null;
        if (
          !table ||
          !(await first(
            DB,
            `SELECT 1 AS ok FROM ${table[0]} WHERE id=? AND ${table[1]}=?`,
            input.sourceId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        const now = ms(input.at);
        await run(
          DB,
          "INSERT INTO redaction_jobs (id,user_id,source_kind,source_id,status,created_at,updated_at) VALUES (?,?,?,?,'queued',?,?)",
          input.id,
          input.actorId,
          input.sourceKind,
          input.sourceId,
          now,
          now,
        );
      },
      async block(input) {
        await assertSelfD1(input.actorId, input.blockerUserId);
        if (
          input.blockerUserId === input.blockedUserId ||
          !(await repository.users.findById(input.blockedUserId))
        )
          throw new Error("forbidden");
        await run(
          DB,
          "INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES (?,?,?)",
          input.blockerUserId,
          input.blockedUserId,
          ms(input.at),
        );
      },
      async isBlockedEitherWay(a, b) {
        return Boolean(
          await first(
            DB,
            "SELECT 1 AS ok FROM blocks WHERE revoked_at IS NULL AND ((blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)) LIMIT 1",
            a,
            b,
            b,
            a,
          ),
        );
      },
    },
    lifecycle: {
      async requestExport(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO export_jobs (id,user_id,status,created_at,updated_at) VALUES (?,?,'queued',?,?)",
          input.id,
          input.userId,
          ms(input.at),
          ms(input.at),
        );
      },
      async requestDeletion(input) {
        await assertSelfD1(input.actorId, input.userId);
        await run(
          DB,
          "INSERT INTO deletion_jobs (id,user_id,status,requested_at,updated_at) VALUES (?,?,'queued',?,?)",
          input.id,
          input.userId,
          ms(input.at),
          ms(input.at),
        );
      },
      async getJob(id, userId) {
        const row = await first<{
          id: string;
          kind: "export" | "deletion";
          status: string;
        }>(
          DB,
          "SELECT id,'export' AS kind,status FROM export_jobs WHERE id=? AND user_id=? UNION ALL SELECT id,'deletion' AS kind,status FROM deletion_jobs WHERE id=? AND user_id=? LIMIT 1",
          id,
          userId,
          id,
          userId,
        );
        return row ?? null;
      },
    },
    idempotency: {
      async begin(input) {
        if (input.expiresAt <= input.at)
          throw new Error("idempotency_invalid_expiry");
        const acquired = await first<{ id: string }>(
          DB,
          "INSERT INTO idempotency_keys (id,actor_user_id,operation,key_hash,request_hash,status,response_json,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,'processing',NULL,?,?,?) ON CONFLICT(actor_user_id,operation,key_hash) DO UPDATE SET id=excluded.id,request_hash=excluded.request_hash,status='processing',response_json=NULL,expires_at=excluded.expires_at,updated_at=excluded.updated_at WHERE idempotency_keys.expires_at<=excluded.created_at RETURNING id",
          input.id,
          input.actorUserId,
          input.operation,
          input.keyHash,
          input.requestHash,
          ms(input.expiresAt),
          ms(input.at),
          ms(input.at),
        );
        if (acquired) return { status: "acquired" };
        const existing = await first<{
          requestHash: string;
          responseJson: string | null;
        }>(
          DB,
          "SELECT request_hash AS requestHash,response_json AS responseJson FROM idempotency_keys WHERE actor_user_id=? AND operation=? AND key_hash=?",
          input.actorUserId,
          input.operation,
          input.keyHash,
        );
        if (!existing) throw new Error("idempotency_state_missing");
        return existing.requestHash === input.requestHash
          ? { status: "replay", responseJson: existing.responseJson }
          : { status: "conflict" };
      },
      async complete(id, actorUserId, responseJson, at) {
        return changed(
          await execute(
            DB,
            "UPDATE idempotency_keys SET status='complete',response_json=?,updated_at=? WHERE id=? AND actor_user_id=? AND status='processing'",
            responseJson,
            ms(at),
            id,
            actorUserId,
          ),
        );
      },
    },
    audit: {
      async append(value) {
        await run(
          DB,
          "INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
          value.id,
          value.actorUserId,
          value.action,
          value.objectKind,
          value.objectId,
          value.metadataJson,
          ms(value.createdAt),
        );
      },
      async listForObject(kind, id) {
        const rows = await all<{
          id: string;
          actorUserId: string | null;
          action: string;
          objectKind: string;
          objectId: string;
          metadataJson: string;
          createdAt: number;
        }>(
          DB,
          "SELECT id,actor_user_id AS actorUserId,action,object_kind AS objectKind,object_id AS objectId,metadata_json AS metadataJson,created_at AS createdAt FROM audit_events WHERE object_kind=? AND object_id=? ORDER BY created_at",
          kind,
          id,
        );
        return rows.map((row) => ({
          ...row,
          actorUserId: row.actorUserId as UserId | null,
          createdAt: new Date(row.createdAt),
        }));
      },
    },
    privateResources: {
      async create(resource) {
        await assertSelfD1(resource.actorId, resource.ownerUserId);
        await run(
          DB,
          "INSERT INTO private_capability_records (id,owner_user_id,value,created_at) VALUES (?,?,?,?)",
          resource.id,
          resource.ownerUserId,
          resource.value,
          ms(resource.createdAt),
        );
      },
      async readForOwner(id, actorUserId) {
        const row = await first<{
          id: string;
          ownerUserId: string;
          value: string;
          createdAt: number;
        }>(
          DB,
          "SELECT id,owner_user_id AS ownerUserId,value,created_at AS createdAt FROM private_capability_records WHERE id=? AND owner_user_id=? LIMIT 1",
          id,
          actorUserId,
        );
        return row
          ? ({
              ...row,
              ownerUserId: row.ownerUserId as UserId,
              createdAt: new Date(row.createdAt),
            } satisfies PrivateResource)
          : null;
      },
      async updateForOwner(id, actorUserId, value) {
        return changed(
          await execute(
            DB,
            "UPDATE private_capability_records SET value=? WHERE id=? AND owner_user_id=?",
            value,
            id,
            actorUserId,
          ),
        );
      },
    },
  };
  return repository;

  async function surfaceAuthority(
    surfaceId: string,
    actorId: UserId,
    action: "member" | "publish",
  ) {
    const surface = await first<{
      ownerUserId: string;
      kind: "profile" | "room" | "circle";
      subjectId: string;
    }>(
      DB,
      "SELECT owner_user_id AS ownerUserId,kind,subject_id AS subjectId FROM surfaces WHERE id=?",
      surfaceId,
    );
    if (!surface) return false;
    if (surface.kind === "profile") return surface.ownerUserId === actorId;
    if (surface.kind === "room")
      return (
        action === "member" &&
        repository.rooms.isActiveMember(surface.subjectId as RoomId, actorId)
      );
    if (surface.kind === "circle") {
      const role = await repository.circles.getActiveRole(
        surface.subjectId as import("@buildmates/domain").CircleId,
        actorId,
      );
      return action === "publish" ? isAdmin(role) : Boolean(role);
    }
    return false;
  }

  async function canOwnSurfaceSubject(
    kind: "profile" | "room" | "circle",
    subjectId: string,
    ownerId: UserId,
  ) {
    if (kind === "profile")
      return Boolean(
        await first(
          DB,
          "SELECT 1 AS ok FROM profiles WHERE id=? AND user_id=?",
          subjectId,
          ownerId,
        ),
      );
    if (kind === "room")
      return repository.rooms.isActiveMember(subjectId as RoomId, ownerId);
    return Boolean(
      await repository.circles.getActiveRole(
        subjectId as import("@buildmates/domain").CircleId,
        ownerId,
      ),
    );
  }

  async function isOperatorD1(actorId: UserId) {
    const user = await repository.users.findById(actorId);
    return user?.operatorRole === "moderator" || user?.operatorRole === "admin";
  }
  async function proposalMember(proposalId: string, actorId: UserId) {
    return Boolean(
      await first(
        DB,
        "SELECT 1 AS ok FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id WHERE p.id=? AND (mp.user_a_id=? OR mp.user_b_id=?)",
        proposalId,
        actorId,
        actorId,
      ),
    );
  }
  async function assertSelfD1(actorId: UserId, targetId: UserId) {
    if (actorId !== targetId || !(await repository.users.findById(actorId)))
      throw new Error("forbidden");
  }
  async function currentSurfaceRevisionNumber(surfaceId: string) {
    const row = await first<{ value: number | null }>(
      DB,
      "SELECT r.revision_number AS value FROM surfaces s LEFT JOIN surface_revisions r ON r.id=s.published_revision_id WHERE s.id=?",
      surfaceId,
    );
    return row?.value ?? null;
  }
  async function surfacePublishState(surfaceId: string, revisionId: string) {
    return first<{
      ownerUserId: string;
      kind: "profile" | "room" | "circle";
      subjectId: string;
      governanceVersion: number;
      publishedRevisionId: string | null;
      currentRevisionNumber: number | null;
      baseRevisionNumber: number | null;
    }>(
      DB,
      "SELECT s.owner_user_id AS ownerUserId,s.kind,s.subject_id AS subjectId,s.governance_version AS governanceVersion,s.published_revision_id AS publishedRevisionId,current.revision_number AS currentRevisionNumber,target.base_revision_number AS baseRevisionNumber FROM surfaces s JOIN surface_revisions target ON target.surface_id=s.id AND target.id=? LEFT JOIN surface_revisions current ON current.id=s.published_revision_id WHERE s.id=?",
      revisionId,
      surfaceId,
    );
  }
}

function audiencePredicate(alias: string, ownerColumn = "user_id") {
  return `(${alias}.${ownerColumn}=? OR (NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=${alias}.${ownerColumn} AND b.blocked_user_id=?) OR (b.blocked_user_id=${alias}.${ownerColumn} AND b.blocker_user_id=?))) AND (${alias}.cohort_scope_id IS NULL OR EXISTS (SELECT 1 FROM cohort_memberships cm1 JOIN cohort_memberships cm2 ON cm2.cohort_id=cm1.cohort_id WHERE cm1.cohort_id=${alias}.cohort_scope_id AND cm1.user_id=? AND cm2.user_id=${alias}.${ownerColumn} AND cm1.status='active' AND cm2.status='active')) AND (${alias}.audience='public' OR (${alias}.audience='signed_in' AND ?<>'') OR (${alias}.audience='suggested_connections' AND EXISTS (SELECT 1 FROM match_pairs mp WHERE (mp.user_a_id=${alias}.${ownerColumn} AND mp.user_b_id=?) OR (mp.user_b_id=${alias}.${ownerColumn} AND mp.user_a_id=?))) OR (${alias}.audience='mutual_connections' AND EXISTS (SELECT 1 FROM connection_sides cs1 JOIN connection_sides cs2 ON cs2.connection_id=cs1.connection_id JOIN connections c ON c.id=cs1.connection_id WHERE cs1.user_id=${alias}.${ownerColumn} AND cs2.user_id=? AND c.state='active')))))`;
}

async function run(DB: RepositoryD1, query: string, ...values: unknown[]) {
  const result = await execute(DB, query, ...values);
  if (!result.success) throw new Error("d1_write_failed");
}
async function execute(DB: RepositoryD1, query: string, ...values: unknown[]) {
  return DB.prepare(query)
    .bind(...values)
    .run();
}
async function first<T>(DB: RepositoryD1, query: string, ...values: unknown[]) {
  return DB.prepare(query)
    .bind(...values)
    .first<T>();
}
async function all<T>(DB: RepositoryD1, query: string, ...values: unknown[]) {
  return (
    await DB.prepare(query)
      .bind(...values)
      .all<T>()
  ).results;
}
async function batch(DB: RepositoryD1, statements: [string, ...unknown[]][]) {
  const results = await DB.batch(
    statements.map(([query, ...values]) => DB.prepare(query).bind(...values)),
  );
  if (results.some((result) => !result.success))
    throw new Error("d1_batch_failed");
}
async function executeBatch(
  DB: RepositoryD1,
  statements: [string, ...unknown[]][],
) {
  const results = await DB.batch(
    statements.map(([query, ...values]) => DB.prepare(query).bind(...values)),
  );
  if (results.some((result) => !result.success))
    throw new Error("d1_batch_failed");
  return results;
}
function changed(result: Result) {
  return result.success && Number(result.meta?.changes ?? 0) === 1;
}
function ms(value: Date) {
  return value.valueOf();
}
function workSignal(row: {
  id: string;
  userId: string;
  taxonomyVersionId: string;
  summary: string;
  audience: WorkSignalRecord["audience"];
  cohortScopeId: string | null;
  allowMatching: number;
  expiresAt: number;
  createdAt: number;
}): WorkSignalRecord {
  return {
    ...row,
    userId: row.userId as UserId,
    cohortScopeId: row.cohortScopeId as CohortId | null,
    allowMatching: Boolean(row.allowMatching),
    expiresAt: new Date(row.expiresAt),
    createdAt: new Date(row.createdAt),
  };
}
function project(row: {
  id: string;
  ownerUserId: string;
  slug: string;
  title: string;
  summary: string;
  audience: ProjectRecord["audience"];
  cohortScopeId: string | null;
  allowMatching: number;
  status: ProjectRecord["status"];
  createdAt: number;
}): ProjectRecord {
  return {
    ...row,
    id: row.id as ProjectId,
    ownerUserId: row.ownerUserId as UserId,
    cohortScopeId: row.cohortScopeId as CohortId | null,
    allowMatching: Boolean(row.allowMatching),
    createdAt: new Date(row.createdAt),
  };
}
function surfaceRevision(row: {
  id: string;
  surfaceId: string;
  authorUserId: string;
  revisionNumber: number;
  baseRevisionNumber: number | null;
  designPolicyId: string;
  designPolicyVersion: string;
  specJson: string;
  createdAt: number;
}): SurfaceRevisionRecord {
  return {
    id: row.id,
    surfaceId: row.surfaceId,
    authorUserId: row.authorUserId as UserId,
    revisionNumber: row.revisionNumber,
    baseRevisionNumber: row.baseRevisionNumber,
    designPolicyId: row.designPolicyId,
    designPolicyVersion: row.designPolicyVersion,
    specJson: row.specJson,
    createdAt: new Date(row.createdAt),
  };
}

function parseRevisionSpec(specJson: string, expectedVersion?: string, forRevisionCreation = false) {
  return parseSurfaceSpecJson(specJson, expectedVersion, { forRevisionCreation });
}
function message(row: {
  id: string;
  roomId: string;
  senderUserId: string;
  clientMessageId: string;
  body: string;
  createdAt: number;
}): MessageRecord {
  return {
    ...row,
    roomId: row.roomId as RoomId,
    senderUserId: row.senderUserId as UserId,
    createdAt: new Date(row.createdAt),
  };
}
function report(row: {
  id: string;
  reporterUserId: string;
  targetKind: string;
  targetId: string;
  reasonCode: string;
  status: ReportRecord["status"];
  createdAt: number;
}): ReportRecord {
  return {
    ...row,
    reporterUserId: row.reporterUserId as UserId,
    createdAt: new Date(row.createdAt),
  };
}
function isAdmin(role: "member" | "admin" | "owner" | null) {
  return role === "admin" || role === "owner";
}
