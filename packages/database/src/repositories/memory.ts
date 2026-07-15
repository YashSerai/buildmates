import {
  acceptanceModeSchema,
  appAccessModeSchema,
  audienceSchema,
  can,
  canonicalPair,
  type AuditRecord,
  type BuildmatesRepositories,
  type CircleId,
  type Cohort,
  type CohortId,
  type CohortInvitation,
  type ConnectedAppPreference,
  type ConnectionCardRecord,
  type ConnectionId,
  type ConnectionRecord,
  type IdempotencyRepository,
  type InviteLinkRecord,
  type MatchPairRecord,
  type MessageRecord,
  type NotificationRecord,
  type PrivateResource,
  type Profile,
  type ProfileId,
  type ProjectId,
  type ProjectRecord,
  type ReportRecord,
  type RoomId,
  type SurfaceRevisionRecord,
  type User,
  type UserId,
  type WorkSignalRecord,
} from "@buildmates/domain";
import { isSurfacePolicyCompatible, parseSurfaceSpecJson } from "@buildmates/surfaces/schema";

type CohortValue = Cohort & {
  name: string;
  description: string;
  communityCreated: boolean;
};
type Membership = { role: "member" | "admin" | "owner"; status: string };

export function createMemoryRepositories(): BuildmatesRepositories {
  const users = new Map<UserId, User>();
  const profiles = new Map<ProfileId, Profile>();
  const handles = new Set<string>();
  const cohorts = new Map<CohortId, CohortValue>();
  const cohortMembers = new Map<string, Membership>();
  const cohortInvites = new Map<
    string,
    CohortInvitation & { status: string; respondedAt: Date | null }
  >();
  const apps = new Map<string, ConnectedAppPreference>();
  const taxonomies = new Map<string, { version: number; status: string }>();
  const topics = new Map<
    string,
    { taxonomyVersionId: string; slug: string; label: string }
  >();
  const signals = new Map<string, WorkSignalRecord>();
  const projects = new Map<ProjectId, ProjectRecord>();
  const collaborators = new Map<
    string,
    { role: "viewer" | "editor" | "owner"; approvedAt: Date | null }
  >();
  const networkingRecords = new Set<string>();
  const inviteLinks = new Map<
    string,
    InviteLinkRecord & { useCount: number; revokedAt: Date | null }
  >();
  const cards = new Map<
    string,
    ConnectionCardRecord & { useCount: number; revokedAt: Date | null }
  >();
  const policies = new Map<
    string,
    {
      id: string;
      version: string;
      sourceHash: string;
      policyJson: string;
      activatedAt: Date;
      at: Date;
    }
  >();
  const surfaces = new Map<
    string,
    {
      ownerUserId: UserId;
      kind: string;
      subjectId: string;
      at: Date;
      publishedRevisionId: string | null;
      governanceVersion: number;
    }
  >();
  const revisions = new Map<string, SurfaceRevisionRecord>();
  const revisionStatuses = new Map<string, "draft" | "published">();
  const surfaceApprovals = new Map<
    string,
    { governanceVersion: number; decision: "approved" | "rejected" }
  >();
  const personalViews = new Map<string, unknown>();
  const assets = new Map<string, unknown>();
  const revisionNumbers = new Set<string>();
  const pairs = new Map<string, MatchPairRecord>();
  const builderIndexes = new Map<
    UserId,
    { version: number; taxonomyVersionId: string; topicsJson: string }
  >();
  const pairScores = new Map<string, unknown>();
  const candidateBatches = new Map<string, unknown>();
  const pairKeys = new Set<string>();
  const matchedPairIds = new Set<string>();
  const proposalPairs = new Map<string, string>();
  const matchPairsByMatchId = new Map<string, string>();
  const evaluations = new Set<string>();
  const humanResponses = new Set<string>();
  const connections = new Map<ConnectionId, ConnectionRecord>();
  const connectionMembers = new Map<ConnectionId, Set<UserId>>();
  const connectionNotes = new Map<
    string,
    { ownerUserId: UserId; body: string }
  >();
  const connectionStateRecords = new Set<string>();
  const rooms = new Map<
    RoomId,
    {
      matchPairId: string;
      connectionId: ConnectionId;
      members: Set<UserId>;
      at: Date;
    }
  >();
  const messages = new Map<RoomId, MessageRecord[]>();
  const messageClientKeys = new Set<string>();
  const feedback = new Set<string>();
  const upgrades = new Set<string>();
  const circles = new Map<
    CircleId,
    {
      name: string;
      purpose: string;
      governanceMode: "admin" | "vote";
      governanceVersion: number;
      at: Date;
    }
  >();
  const circleMembers = new Map<string, Membership>();
  const circleRecords = new Set<string>();
  const circleProposals = new Map<
    string,
    {
      circleId: CircleId;
      kind: "design" | "module" | "rules" | "membership";
      payloadJson: string;
      governanceVersion: number;
      status: "voting" | "approved" | "published";
    }
  >();
  const circleVotes = new Map<string, "approve" | "reject" | "abstain">();
  const circleMetricOwners = new Map<string, CircleId>();
  const notifications = new Map<UserId, NotificationRecord[]>();
  const reports = new Map<string, ReportRecord>();
  const moderationRecords = new Set<string>();
  const moderationCases = new Map<string, string>();
  const blocks = new Set<string>();
  const exportJobs = new Map<string, { userId: UserId; status: string }>();
  const deletionJobs = new Map<string, { userId: UserId; status: string }>();
  const idempotency = new Map<
    string,
    {
      id: string;
      requestHash: string;
      status: string;
      responseJson: string | null;
      expiresAt: Date;
    }
  >();
  const idempotencyById = new Map<string, string>();
  const audits: AuditRecord[] = [];
  const checkpoints = new Map<
    string,
    { cursor: string | null; stateJson: string }
  >();
  const resources = new Map<string, PrivateResource>();

  const repository: BuildmatesRepositories = {
    users: {
      async create(user) {
        unique(users, user.id, user, "user_conflict");
      },
      async findById(id) {
        return clone(users.get(id) ?? null);
      },
    },
    profiles: {
      async create(profile) {
        audienceSchema.parse(profile.audience);
        acceptanceModeSchema.parse(profile.acceptanceMode);
        assertSelf(users, profile.actorId, profile.userId);
        const normalized = profile.handle.trim().toLowerCase();
        if (handles.has(normalized) || profiles.has(profile.id))
          throw new Error("profile_conflict");
        const { actorId: _actorId, ...stored } = profile;
        void _actorId;
        handles.add(normalized);
        profiles.set(profile.id, clone(stored));
      },
      async findByIdForViewer(id, viewerId) {
        const profile = profiles.get(id);
        if (
          !profile ||
          !(await visible(
            profile.userId,
            viewerId,
            profile.audience,
            profile.cohortScopeId,
          ))
        )
          return null;
        return clone(profile);
      },
    },
    connectedApps: {
      async save(value) {
        appAccessModeSchema.parse(value.accessMode);
        assertSelf(users, value.actorId, value.userId);
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        apps.set(`${value.userId}\0${value.appId}`, clone(stored));
      },
      async listForUser(userId) {
        return clone(
          [...apps.values()].filter((value) => value.userId === userId),
        );
      },
    },
    workSignals: {
      async create(value) {
        audienceSchema.parse(value.audience);
        assertSelf(users, value.actorId, value.userId);
        if (!taxonomies.has(value.taxonomyVersionId))
          throw new Error("taxonomy_not_found");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        unique(signals, value.id, stored, "work_signal_conflict");
      },
      async listVisible(subjectUserId, viewerUserId, at) {
        const result: WorkSignalRecord[] = [];
        for (const value of signals.values())
          if (
            value.userId === subjectUserId &&
            value.expiresAt > at &&
            (await visible(
              subjectUserId,
              viewerUserId,
              value.audience,
              value.cohortScopeId,
            ))
          )
            result.push(clone(value));
        return result;
      },
    },
    taxonomy: {
      async createVersion(input) {
        if (
          [...taxonomies.values()].some(
            (value) => value.version === input.version,
          )
        )
          throw new Error("taxonomy_conflict");
        unique(
          taxonomies,
          input.id,
          { version: input.version, status: input.status },
          "taxonomy_conflict",
        );
      },
      async createTopic(input) {
        if (
          !taxonomies.has(input.taxonomyVersionId) ||
          [...topics.values()].some(
            (value) =>
              value.taxonomyVersionId === input.taxonomyVersionId &&
              value.slug === input.slug,
          )
        )
          throw new Error("topic_conflict");
        unique(
          topics,
          input.id,
          {
            taxonomyVersionId: input.taxonomyVersionId,
            slug: input.slug,
            label: input.label,
          },
          "topic_conflict",
        );
      },
    },
    projects: {
      async create(value) {
        audienceSchema.parse(value.audience);
        assertSelf(users, value.actorId, value.ownerUserId);
        if (
          [...projects.values()].some(
            (project) =>
              project.ownerUserId === value.ownerUserId &&
              project.slug === value.slug,
          )
        )
          throw new Error("project_conflict");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        unique(projects, value.id, stored, "project_conflict");
      },
      async findVisible(id, viewerUserId) {
        const value = projects.get(id);
        const collaborator = viewerUserId
          ? collaborators.get(`${id}\0${viewerUserId}`)
          : null;
        if (
          !value ||
          value.status === "deleted" ||
          (!collaborator?.approvedAt &&
            !(await visible(
              value.ownerUserId,
              viewerUserId,
              value.audience,
              value.cohortScopeId,
            )))
        )
          return null;
        return clone(value);
      },
      async setCollaborator(input) {
        const project = projects.get(input.projectId);
        if (!project) throw new Error("project_not_found");
        if (project.ownerUserId !== input.actorId) throw new Error("forbidden");
        collaborators.set(`${input.projectId}\0${input.userId}`, {
          role: input.role,
          approvedAt: input.approvedAt,
        });
      },
      async getCollaboratorRole(projectId, userId) {
        const value = collaborators.get(`${projectId}\0${userId}`);
        return value?.approvedAt ? value.role : null;
      },
      async canEdit(projectId, actorId) {
        const project = projects.get(projectId);
        if (!project) return false;
        if (project.ownerUserId === actorId) return true;
        const value = collaborators.get(`${projectId}\0${actorId}`);
        return Boolean(
          value?.approvedAt &&
          (value.role === "editor" || value.role === "owner"),
        );
      },
    },
    networking: {
      async savePulse(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(networkingRecords, `pulse\0${input.id}`);
      },
      async setBudget(input) {
        assertSelf(users, input.actorId, input.userId);
        networkingRecords.add(
          `budget\0${input.userId}\0${input.maximumPerWeek}`,
        );
      },
      async addQuietHours(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(
          networkingRecords,
          `quiet\0${input.userId}\0${input.weekday}\0${input.startMinute}\0${input.endMinute}`,
        );
      },
      async snooze(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(networkingRecords, `snooze\0${input.id}`);
      },
      async exclude(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(
          networkingRecords,
          `exclude\0${input.userId}\0${input.kind}\0${input.normalizedValue}`,
        );
      },
      async watch(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(
          networkingRecords,
          `watch\0${input.userId}\0${input.kind}\0${input.targetId}`,
        );
      },
      async follow(input) {
        assertSelf(users, input.actorId, input.userId);
        uniqueSet(
          networkingRecords,
          `follow\0${input.userId}\0${input.targetKind}\0${input.targetId}`,
        );
      },
    },
    invites: {
      async createLink(value) {
        assertSelf(users, value.actorId, value.creatorUserId);
        if (
          [...inviteLinks.values()].some(
            (link) => link.tokenHash === value.tokenHash,
          )
        )
          throw new Error("invite_conflict");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        inviteLinks.set(value.id, {
          ...clone(stored),
          useCount: 0,
          revokedAt: null,
        });
      },
      async consumeLink(tokenHash, at) {
        const link = [...inviteLinks.values()].find(
          (value) => value.tokenHash === tokenHash,
        );
        if (
          !link ||
          link.revokedAt ||
          link.expiresAt <= at ||
          link.useCount >= link.maximumUses
        )
          return false;
        link.useCount += 1;
        return true;
      },
      async createConnectionCard(value) {
        assertSelf(users, value.actorId, value.creatorUserId);
        if (
          value.projectId &&
          !(await repository.projects.canEdit(
            value.projectId,
            value.actorId,
          )) &&
          projects.get(value.projectId)?.ownerUserId !== value.actorId
        )
          throw new Error("forbidden");
        if (
          [...cards.values()].some((card) => card.tokenHash === value.tokenHash)
        )
          throw new Error("connection_card_conflict");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        cards.set(value.id, { ...clone(stored), useCount: 0, revokedAt: null });
      },
      async consumeConnectionCard(tokenHash, at) {
        const card = [...cards.values()].find(
          (value) => value.tokenHash === tokenHash,
        );
        if (
          !card ||
          card.revokedAt ||
          card.expiresAt <= at ||
          card.useCount >= card.maximumUses
        )
          return null;
        card.useCount += 1;
        return {
          id: card.id,
          creatorUserId: card.creatorUserId,
          projectId: card.projectId,
          headline: card.headline,
        };
      },
    },
    cohorts: {
      async create(cohort) {
        requireUser(users, cohort.actorId);
        if (
          cohorts.has(cohort.id) ||
          [...cohorts.values()].some((value) => value.slug === cohort.slug)
        )
          throw new Error("cohort_conflict");
        const { actorId, ...stored } = cohort;
        cohorts.set(cohort.id, clone(stored));
        cohortMembers.set(memberKey(cohort.id, actorId), {
          role: "owner",
          status: "active",
        });
      },
      async findByIdForViewer(id, viewerUserId) {
        const cohort = cohorts.get(id);
        if (!cohort) return null;
        if (
          cohort.visibility !== "public" &&
          (!viewerUserId ||
            !(await repository.cohorts.getActiveRole(id, viewerUserId)))
        )
          return null;
        return clone(cohort);
      },
      async setMembership(input) {
        requireUser(users, input.actorId);
        requireUser(users, input.userId);
        if (!cohorts.has(input.cohortId)) throw new Error("cohort_not_found");
        const actor = cohortMembers.get(
          memberKey(input.cohortId, input.actorId),
        );
        const current = cohortMembers.get(
          memberKey(input.cohortId, input.userId),
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
        cohortMembers.set(memberKey(input.cohortId, input.userId), {
          role: selfExit && current ? current.role : input.role,
          status: input.status,
        });
      },
      async transferOwnership(input) {
        requireUser(users, input.actorId);
        requireUser(users, input.newOwnerUserId);
        if (input.actorId === input.newOwnerUserId)
          throw new Error("ownership_conflict");
        const owners = [...cohortMembers.entries()].filter(
          ([key, member]) =>
            key.startsWith(`${input.cohortId}\0`) &&
            member.status === "active" &&
            member.role === "owner",
        );
        const actor = cohortMembers.get(
          memberKey(input.cohortId, input.actorId),
        );
        const next = cohortMembers.get(
          memberKey(input.cohortId, input.newOwnerUserId),
        );
        if (
          owners.length !== 1 ||
          actor?.role !== "owner" ||
          actor.status !== "active" ||
          next?.status !== "active" ||
          next.role === "owner"
        )
          throw new Error("ownership_conflict");
        actor.role = input.demoteOldOwnerTo;
        next.role = "owner";
      },
      async getActiveRole(cohortId, userId) {
        const value = cohortMembers.get(memberKey(cohortId, userId));
        return value?.status === "active" ? value.role : null;
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
        if (
          [...cohortInvites.values()].some(
            (value) =>
              value.tokenHash === input.tokenHash ||
              (value.cohortId === input.cohortId &&
                value.inviteeUserId === input.inviteeUserId &&
                value.status === "pending"),
          )
        )
          throw new Error("cohort_invitation_conflict");
        const { actorId: _actorId, ...stored } = input;
        void _actorId;
        cohortInvites.set(input.id, {
          ...clone(stored),
          status: "pending",
          respondedAt: null,
        });
      },
      async respondToInvitation(id, actorId, decision, at) {
        const invite = cohortInvites.get(id);
        if (
          !invite ||
          invite.inviteeUserId !== actorId ||
          invite.status !== "pending" ||
          invite.expiresAt <= at
        )
          return null;
        invite.status = decision;
        invite.respondedAt = at;
        if (decision === "accepted") {
          const current = cohortMembers.get(
            memberKey(invite.cohortId, actorId),
          );
          cohortMembers.set(memberKey(invite.cohortId, actorId), {
            role: current?.role ?? "member",
            status: "active",
          });
        }
        return {
          cohortId: invite.cohortId,
          membershipActivated: decision === "accepted",
        };
      },
    },
    surfaces: {
      async createPolicy(input) {
        const existing = policies.get(input.id) ?? [...policies.values()].find((value) => value.version === input.version || value.sourceHash === input.sourceHash);
        if (existing) {
          if (
            existing.id === input.id && existing.version === input.version && existing.sourceHash === input.sourceHash &&
            existing.policyJson === input.policyJson && existing.activatedAt.getTime() === input.activatedAt.getTime()
          ) return;
          throw new Error("policy_conflict");
        }
        policies.set(input.id, clone(input));
      },
      async createSurface(input) {
        requireUser(users, input.actorId);
        if (
          input.actorId !== input.ownerUserId ||
          !(await canOwnSurfaceSubject(
            input.kind,
            input.subjectId,
            input.ownerUserId,
          ))
        )
          throw new Error("forbidden");
        const { actorId: _actorId, ...stored } = input;
        void _actorId;
        unique(
          surfaces,
          input.id,
          { ...clone(stored), publishedRevisionId: null, governanceVersion: 1 },
          "surface_conflict",
        );
      },
      async createRevision(value) {
        if (
          value.actorId !== value.authorUserId ||
          !(await canActOnSurface(value.surfaceId, value.actorId, "member"))
        )
          throw new Error("forbidden");
        if (
          !surfaces.has(value.surfaceId) ||
          !policies.has(value.designPolicyId)
        )
          throw new Error("surface_dependency_missing");
        const surface = surfaces.get(value.surfaceId)!;
        const policy = policies.get(value.designPolicyId);
        if (!policy || policy.activatedAt.getTime() > value.createdAt.getTime()) throw new Error("surface_dependency_missing");
        if (!isSurfacePolicyCompatible(policy, { forRevisionCreation: true })) throw new Error("surface_revision_policy_mismatch");
        const parsedSpec = parseRevisionSpec(value.specJson, policy.version, true);
        if (parsedSpec.kind !== surface.kind || parsedSpec.designPolicyVersion !== policy.version || value.designPolicyVersion !== policy.version) throw new Error("surface_revision_policy_mismatch");
        const current = surface.publishedRevisionId
          ? (revisions.get(surface.publishedRevisionId)?.revisionNumber ?? null)
          : null;
        if (value.baseRevisionNumber !== current)
          throw new Error("stale_surface_base");
        const numberKey = `${value.surfaceId}\0${value.revisionNumber}`;
        if (revisions.has(value.id) || revisionNumbers.has(numberKey))
          throw new Error("surface_revision_conflict");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        revisions.set(value.id, clone({ ...stored, visibility: value.visibility ?? "private_preview" }));
        revisionStatuses.set(value.id, "draft");
        revisionNumbers.add(numberKey);
      },
      async findRevisionForViewer(id, viewerUserId) {
        const revision = revisions.get(id);
        if (!revision) return null;
        const surface = surfaces.get(revision.surfaceId);
        if (!surface) return null;
        const policy = policies.get(revision.designPolicyId);
        try {
          if (!policy || !isSurfacePolicyCompatible(policy)) return null;
          const parsed = parseRevisionSpec(revision.specJson, policy?.version);
          if (!policy || revision.designPolicyVersion !== policy.version || parsed.kind !== surface.kind) return null;
        } catch { return null; }
        if (
          viewerUserId &&
          (revision.visibility === "personal_view"
            ? revision.authorUserId === viewerUserId
            : surface.ownerUserId === viewerUserId || revision.authorUserId === viewerUserId) &&
          (await canActOnSurface(revision.surfaceId, viewerUserId, "member"))
        )
          return clone(revision);
        if (
          revisionStatuses.get(id) !== "published" ||
          surface.publishedRevisionId !== id
        )
          return null;
        return (await canReadPublishedSurface(revision.surfaceId, viewerUserId))
          ? clone(revision)
          : null;
      },
      async decideRevision(input) {
        const revision = revisions.get(input.revisionId);
        const surface = revision ? surfaces.get(revision.surfaceId) : null;
        const current = surface?.publishedRevisionId
          ? (revisions.get(surface.publishedRevisionId)?.revisionNumber ?? null)
          : null;
        if (
          !revision ||
          !surface ||
          revision.visibility === "personal_view" ||
          revision.baseRevisionNumber !== current ||
          input.governanceVersion !== surface.governanceVersion ||
          !(await canActOnSurface(revision.surfaceId, input.actorId, "member"))
        )
          throw new Error("forbidden");
        surfaceApprovals.set(`${input.revisionId}\0${input.actorId}`, {
          governanceVersion: input.governanceVersion,
          decision: input.decision,
        });
      },
      async publishRevision(input) {
        const revision = revisions.get(input.revisionId);
        const surface = surfaces.get(input.surfaceId);
        const current = surface?.publishedRevisionId
          ? (revisions.get(surface.publishedRevisionId)?.revisionNumber ?? null)
          : null;
        if (
          !revision ||
          !surface ||
          revision.visibility === "personal_view" ||
          revision.surfaceId !== input.surfaceId ||
          revision.baseRevisionNumber !== current ||
          input.expectedPublishedRevisionNumber !== current ||
          input.governanceVersion !== surface.governanceVersion
        )
          throw new Error("surface_conflict");
        if (surface.kind === "profile") {
          if (surface.ownerUserId !== input.actorId)
            throw new Error("forbidden");
        } else if (surface.kind === "room") {
          const room = rooms.get(surface.subjectId as RoomId);
          if (
            !room ||
            !(await repository.rooms.isActiveMember(
              surface.subjectId as RoomId,
              input.actorId,
            ))
          )
            throw new Error("forbidden");
          for (const member of room.members) {
            const approval = surfaceApprovals.get(
              `${input.revisionId}\0${member}`,
            );
            if (
              !approval ||
              approval.decision !== "approved" ||
              approval.governanceVersion !== surface.governanceVersion
            )
              throw new Error("approval_required");
          }
        } else {
          const circle = circles.get(surface.subjectId as CircleId);
          const role = await repository.circles.getActiveRole(
            surface.subjectId as CircleId,
            input.actorId,
          );
          if (!circle || !role) throw new Error("forbidden");
          if (circle.governanceVersion !== input.governanceVersion)
            throw new Error("stale_governance");
          if (circle.governanceMode === "admin") {
            if (!isAdmin(role)) throw new Error("forbidden");
          } else {
            const proposal = input.proposalId
              ? circleProposals.get(input.proposalId)
              : null;
            let payload: unknown = null;
            try {
              payload = proposal ? JSON.parse(proposal.payloadJson) : null;
            } catch {
              payload = null;
            }
            if (
              !proposal ||
              proposal.circleId !== surface.subjectId ||
              proposal.kind !== "design" ||
              proposal.governanceVersion !== circle.governanceVersion ||
              (payload as { revisionId?: string } | null)?.revisionId !==
                input.revisionId
            )
              throw new Error("proposal_required");
            const active = [...circleMembers.entries()].filter(
              ([key, member]) =>
                key.startsWith(`${surface.subjectId}\0`) &&
                member.status === "active",
            );
            const approvals = active.filter(
              ([key]) =>
                circleVotes.get(
                  `${input.proposalId}\0${key.slice(key.indexOf("\0") + 1)}`,
                ) === "approve",
            ).length;
            if (approvals <= active.length / 2)
              throw new Error("vote_threshold_not_met");
            proposal.status = "approved";
          }
        }
        revisionStatuses.set(input.revisionId, "published");
        surface.publishedRevisionId = input.revisionId;
        if (input.proposalId) {
          const proposal = circleProposals.get(input.proposalId);
          if (proposal) proposal.status = "published";
        }
      },
      async setPersonalView(input) {
        const revision = revisions.get(input.revisionId);
        if (
          !surfaces.has(input.surfaceId) ||
          revision?.surfaceId !== input.surfaceId ||
          revision.authorUserId !== input.actorId ||
          revision.visibility !== "personal_view" ||
          !(await canActOnSurface(input.surfaceId, input.actorId, "member"))
        )
          throw new Error("forbidden");
        personalViews.set(`${input.surfaceId}\0${input.actorId}`, clone(input));
      },
      async addAsset(input) {
        assertSelf(users, input.actorId, input.ownerUserId);
        unique(assets, input.id, clone(input), "asset_conflict");
      },
    },
    matching: {
      async upsertBuilderIndex(input) {
        assertSelf(users, input.actorId, input.userId);
        if (!taxonomies.has(input.taxonomyVersionId))
          throw new Error("taxonomy_not_found");
        const current = builderIndexes.get(input.userId);
        if (current && input.version <= current.version)
          throw new Error("stale_index_version");
        builderIndexes.set(input.userId, {
          version: input.version,
          taxonomyVersionId: input.taxonomyVersionId,
          topicsJson: input.topicsJson,
        });
      },
      async recordPairScore(input) {
        const [a, b] = canonicalPair(input.userAId, input.userBId);
        if (
          a !== input.userAId ||
          b !== input.userBId ||
          input.totalBasisPoints < 0 ||
          input.totalBasisPoints > 10000
        )
          throw new Error("pair_score_invalid");
        unique(pairScores, input.id, clone(input), "pair_score_conflict");
      },
      async createCandidateBatch(input) {
        assertSelf(users, input.actorId, input.userId);
        unique(
          candidateBatches,
          input.id,
          clone(input),
          "candidate_batch_conflict",
        );
      },
      async createPair(value) {
        const [a, b] = canonicalPair(value.userAId, value.userBId);
        if (
          a !== value.userAId ||
          b !== value.userBId ||
          pairKeys.has(`${a}\0${b}`)
        )
          throw new Error("match_pair_conflict");
        unique(pairs, value.id, value, "match_pair_conflict");
        pairKeys.add(`${a}\0${b}`);
      },
      async findPair(id) {
        return clone(pairs.get(id) ?? null);
      },
      async recordEvaluation(input) {
        assertSelf(users, input.actorId, input.userId);
        const pair = pairs.get(proposalPairs.get(input.proposalId) ?? "");
        if (
          !pair ||
          (pair.userAId !== input.userId && pair.userBId !== input.userId)
        )
          throw new Error("forbidden");
        uniqueSet(evaluations, `${input.proposalId}\0${input.userId}`);
      },
      async recordHumanResponse(input) {
        assertSelf(users, input.actorId, input.userId);
        const pair = pairs.get(proposalPairs.get(input.proposalId) ?? "");
        if (
          !pair ||
          (pair.userAId !== input.userId && pair.userBId !== input.userId)
        )
          throw new Error("forbidden");
        uniqueSet(humanResponses, `${input.proposalId}\0${input.userId}`);
      },
      async recordMatchedProposal(input) {
        if (
          !pairs.has(input.pairId) ||
          proposalPairs.has(input.proposalId) ||
          matchedPairIds.has(input.pairId) ||
          matchPairsByMatchId.has(input.matchId)
        )
          throw new Error("match_conflict");
        matchedPairIds.add(input.pairId);
        proposalPairs.set(input.proposalId, input.pairId);
        matchPairsByMatchId.set(input.matchId, input.pairId);
      },
    },
    connections: {
      async createFromMatch(input) {
        const pairId = matchPairsByMatchId.get(input.matchId);
        const pair = pairId ? pairs.get(pairId) : null;
        if (
          !pair ||
          pairId !== input.expectedMatchPairId ||
          [...connections.values()].some(
            (item) =>
              item.matchPairId === pairId || item.matchId === input.matchId,
          )
        )
          throw new Error("connection_conflict");
        const value: ConnectionRecord = {
          id: input.id,
          matchPairId: pairId,
          matchId: input.matchId,
          state: "active",
          createdAt: input.at,
        };
        unique(connections, input.id, value, "connection_conflict");
        connectionMembers.set(input.id, new Set([pair.userAId, pair.userBId]));
        return clone(value);
      },
      async findForMember(id, actorUserId) {
        const value = connections.get(id);
        return value && connectionMembers.get(id)?.has(actorUserId)
          ? clone(value)
          : null;
      },
      async updateSide(input) {
        assertSelf(users, input.actorId, input.userId);
        if (!connectionMembers.get(input.connectionId)?.has(input.userId))
          throw new Error("forbidden");
        connectionStateRecords.add(
          `side\0${input.connectionId}\0${input.userId}`,
        );
      },
      async savePrivateNote(input) {
        assertSelf(users, input.actorId, input.ownerUserId);
        if (!connectionMembers.get(input.connectionId)?.has(input.ownerUserId))
          throw new Error("forbidden");
        connectionNotes.set(input.id, {
          ownerUserId: input.ownerUserId,
          body: input.body,
        });
      },
      async readPrivateNote(id, ownerUserId) {
        const note = connectionNotes.get(id);
        return note?.ownerUserId === ownerUserId ? note.body : null;
      },
      async scheduleReminder(input) {
        assertSelf(users, input.actorId, input.userId);
        if (!connectionMembers.get(input.connectionId)?.has(input.userId))
          throw new Error("forbidden");
        uniqueSet(connectionStateRecords, `reminder\0${input.id}`);
      },
      async setUpdateSubscription(input) {
        assertSelf(users, input.actorId, input.subscriberUserId);
        if (
          !connectionMembers
            .get(input.connectionId)
            ?.has(input.subscriberUserId) ||
          !connectionMembers.get(input.connectionId)?.has(input.subjectUserId)
        )
          throw new Error("forbidden");
        connectionStateRecords.add(
          `subscription\0${input.connectionId}\0${input.subscriberUserId}`,
        );
      },
      async requestReconnect(input) {
        assertSelf(users, input.actorId, input.requesterUserId);
        if (
          !connectionMembers.get(input.connectionId)?.has(input.requesterUserId)
        )
          throw new Error("forbidden");
        uniqueSet(connectionStateRecords, `reconnect\0${input.id}`);
      },
    },
    rooms: {
      async createForConnection(input) {
        const connection = connections.get(input.connectionId);
        const members = connectionMembers.get(input.connectionId);
        if (
          !connection ||
          !members ||
          connection.matchPairId !== input.expectedMatchPairId ||
          rooms.has(input.id) ||
          [...rooms.values()].some(
            (room) =>
              room.matchPairId === connection.matchPairId ||
              room.connectionId === input.connectionId,
          )
        )
          throw new Error("room_conflict");
        rooms.set(input.id, {
          matchPairId: connection.matchPairId,
          connectionId: input.connectionId,
          members: new Set(members),
          at: input.at,
        });
        messages.set(input.id, []);
      },
      async isActiveMember(id, actorUserId) {
        const room = rooms.get(id);
        return Boolean(
          room?.members.has(actorUserId) &&
          !(await blockedWithAny(actorUserId, room.members)),
        );
      },
      async sendMessage(value) {
        assertSelf(users, value.actorId, value.senderUserId);
        if (
          !(await repository.rooms.isActiveMember(
            value.roomId,
            value.senderUserId,
          ))
        )
          throw new Error("forbidden");
        const key = `${value.roomId}\0${value.senderUserId}\0${value.clientMessageId}`;
        if (messageClientKeys.has(key)) throw new Error("message_conflict");
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        messageClientKeys.add(key);
        messages.get(value.roomId)!.push(clone(stored));
      },
      async listMessages(id, actorUserId) {
        return (await repository.rooms.isActiveMember(id, actorUserId))
          ? clone(messages.get(id) ?? [])
          : [];
      },
      async submitFeedback(input) {
        assertSelf(users, input.actorId, input.userId);
        if (!connectionMembers.get(input.connectionId)?.has(input.userId))
          throw new Error("forbidden");
        uniqueSet(feedback, `${input.connectionId}\0${input.userId}`);
      },
      async proposeUpgrade(input) {
        assertSelf(users, input.actorId, input.proposerUserId);
        if (
          !(await repository.rooms.isActiveMember(
            input.roomId,
            input.proposerUserId,
          ))
        )
          throw new Error("forbidden");
        uniqueSet(upgrades, input.id);
      },
    },
    circles: {
      async create(input) {
        requireUser(users, input.actorId);
        const { actorId, ...stored } = input;
        unique(
          circles,
          input.id,
          { ...clone(stored), governanceVersion: 1 },
          "circle_conflict",
        );
        circleMembers.set(memberKey(input.id, actorId), {
          role: "owner",
          status: "active",
        });
      },
      async setMembership(input) {
        requireUser(users, input.actorId);
        requireUser(users, input.userId);
        if (!circles.has(input.circleId)) throw new Error("circle_not_found");
        const actor = circleMembers.get(
          memberKey(input.circleId, input.actorId),
        );
        const current = circleMembers.get(
          memberKey(input.circleId, input.userId),
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
        circleMembers.set(memberKey(input.circleId, input.userId), {
          role: selfExit && current ? current.role : input.role,
          status: input.status,
        });
      },
      async transferOwnership(input) {
        requireUser(users, input.actorId);
        requireUser(users, input.newOwnerUserId);
        if (input.actorId === input.newOwnerUserId)
          throw new Error("ownership_conflict");
        const owners = [...circleMembers.entries()].filter(
          ([key, member]) =>
            key.startsWith(`${input.circleId}\0`) &&
            member.status === "active" &&
            member.role === "owner",
        );
        const actor = circleMembers.get(
          memberKey(input.circleId, input.actorId),
        );
        const next = circleMembers.get(
          memberKey(input.circleId, input.newOwnerUserId),
        );
        if (
          owners.length !== 1 ||
          actor?.role !== "owner" ||
          actor.status !== "active" ||
          next?.status !== "active" ||
          next.role === "owner"
        )
          throw new Error("ownership_conflict");
        actor.role = input.demoteOldOwnerTo;
        next.role = "owner";
      },
      async getActiveRole(id, actorUserId) {
        if (!actorUserId) return null;
        const membership = circleMembers.get(memberKey(id, actorUserId));
        if (membership?.status !== "active") return null;
        const activeMembers = [...circleMembers.entries()]
          .filter(
            ([key, value]) =>
              key.startsWith(`${id}\0`) && value.status === "active",
          )
          .map(([key]) => key.split("\0")[1] as UserId);
        return (await blockedWithAny(actorUserId, new Set(activeMembers)))
          ? null
          : membership.role;
      },
      async createProposal(input) {
        const circle = circles.get(input.circleId);
        if (
          !circle ||
          input.governanceVersion !== circle.governanceVersion ||
          !(await repository.circles.getActiveRole(
            input.circleId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        uniqueSet(circleRecords, `proposal\0${input.id}`);
        circleProposals.set(input.id, {
          circleId: input.circleId,
          kind: input.kind,
          payloadJson: input.payloadJson,
          governanceVersion: input.governanceVersion,
          status: "voting",
        });
      },
      async vote(input) {
        const proposal = circleProposals.get(input.proposalId);
        if (
          !proposal ||
          !(await repository.circles.getActiveRole(
            proposal.circleId,
            input.actorId,
          ))
        )
          throw new Error("forbidden");
        circleVotes.set(`${input.proposalId}\0${input.actorId}`, input.vote);
        const active = [...circleMembers.entries()].filter(
          ([key, member]) =>
            key.startsWith(`${proposal.circleId}\0`) &&
            member.status === "active",
        );
        const approvals = active.filter(
          ([key]) =>
            circleVotes.get(
              `${input.proposalId}\0${key.slice(key.indexOf("\0") + 1)}`,
            ) === "approve",
        ).length;
        if (proposal.status !== "published")
          proposal.status =
            approvals > active.length / 2 ? "approved" : "voting";
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
        uniqueSet(circleRecords, `module\0${input.id}`);
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
        uniqueSet(circleRecords, `metric\0${input.id}`);
        circleMetricOwners.set(input.id, input.circleId);
      },
      async recordMetric(input) {
        const circleId = circleMetricOwners.get(input.metricId);
        if (
          !circleId ||
          !(await repository.circles.getActiveRole(circleId, input.actorId))
        )
          throw new Error("forbidden");
        uniqueSet(
          circleRecords,
          `entry\0${input.metricId}\0${input.actorId}\0${input.periodKey}`,
        );
      },
    },
    notifications: {
      async enqueue(value) {
        requireUser(users, value.userId);
        const list = notifications.get(value.userId) ?? [];
        if (list.some((item) => item.id === value.id))
          throw new Error("notification_conflict");
        list.push(clone(value));
        notifications.set(value.userId, list);
      },
      async listForUser(userId) {
        return clone(notifications.get(userId) ?? []);
      },
    },
    automation: {
      async checkpoint(input) {
        assertSelf(users, input.actorId, input.userId);
        checkpoints.set(`${input.userId}\0${input.kind}`, {
          cursor: input.cursor,
          stateJson: input.stateJson,
        });
      },
      async getCheckpoint(userId, kind) {
        return clone(checkpoints.get(`${userId}\0${kind}`) ?? null);
      },
    },
    moderation: {
      async createReport(value) {
        assertSelf(users, value.actorId, value.reporterUserId);
        const { actorId: _actorId, ...stored } = value;
        void _actorId;
        unique(reports, value.id, stored, "report_conflict");
      },
      async findForReporter(id, reporterUserId) {
        const value = reports.get(id);
        return value?.reporterUserId === reporterUserId ? clone(value) : null;
      },
      async openCase(input) {
        if (
          !isOperator(users.get(input.actorId)) ||
          !reports.has(input.reportId)
        )
          throw new Error("forbidden");
        uniqueSet(moderationRecords, `case\0${input.id}`);
        moderationCases.set(input.id, input.reportId);
      },
      async recordAction(input) {
        if (!isOperator(users.get(input.actorId))) throw new Error("forbidden");
        uniqueSet(moderationRecords, `action\0${input.id}`);
      },
      async appeal(input) {
        const user = users.get(input.actorId);
        const report = reports.get(moderationCases.get(input.caseId) ?? "");
        if (
          !user ||
          isOperator(user) ||
          !report ||
          !hasAppealStanding(report, input.actorId)
        )
          throw new Error("forbidden");
        uniqueSet(moderationRecords, `appeal\0${input.id}`);
      },
      async queueRedaction(input) {
        requireUser(users, input.actorId);
        const owned =
          input.sourceKind === "work_signal"
            ? signals.get(input.sourceId)?.userId === input.actorId
            : input.sourceKind === "project"
              ? projects.get(input.sourceId as ProjectId)?.ownerUserId ===
                input.actorId
              : input.sourceKind === "profile"
                ? profiles.get(input.sourceId as ProfileId)?.userId ===
                  input.actorId
                : false;
        if (!owned) throw new Error("forbidden");
        uniqueSet(
          moderationRecords,
          `redaction\0${input.actorId}\0${input.sourceKind}\0${input.sourceId}`,
        );
      },
      async block(input) {
        assertSelf(users, input.actorId, input.blockerUserId);
        requireUser(users, input.blockedUserId);
        if (input.blockerUserId === input.blockedUserId)
          throw new Error("block_self");
        blocks.add(blockKey(input.blockerUserId, input.blockedUserId));
      },
      async isBlockedEitherWay(a, b) {
        return blocks.has(blockKey(a, b)) || blocks.has(blockKey(b, a));
      },
    },
    lifecycle: {
      async requestExport(input) {
        assertSelf(users, input.actorId, input.userId);
        unique(
          exportJobs,
          input.id,
          { userId: input.userId, status: "queued" },
          "job_conflict",
        );
      },
      async requestDeletion(input) {
        assertSelf(users, input.actorId, input.userId);
        unique(
          deletionJobs,
          input.id,
          { userId: input.userId, status: "queued" },
          "job_conflict",
        );
      },
      async getJob(id, userId) {
        const exp = exportJobs.get(id);
        if (exp?.userId === userId)
          return { id, kind: "export", status: exp.status };
        const del = deletionJobs.get(id);
        return del?.userId === userId
          ? { id, kind: "deletion", status: del.status }
          : null;
      },
    },
    idempotency: createMemoryIdempotency(idempotency, idempotencyById),
    audit: {
      async append(value) {
        if (audits.some((item) => item.id === value.id))
          throw new Error("audit_conflict");
        audits.push(clone(value));
      },
      async listForObject(kind, id) {
        return clone(
          audits.filter(
            (value) => value.objectKind === kind && value.objectId === id,
          ),
        );
      },
    },
    privateResources: {
      async create(resource) {
        assertSelf(users, resource.actorId, resource.ownerUserId);
        const { actorId: _actorId, ...stored } = resource;
        void _actorId;
        unique(resources, resource.id, stored, "private_resource_conflict");
      },
      async readForOwner(id, actorUserId) {
        const value = resources.get(id);
        return value?.ownerUserId === actorUserId ? clone(value) : null;
      },
      async updateForOwner(id, actorUserId, value) {
        const current = resources.get(id);
        if (!current || current.ownerUserId !== actorUserId) return false;
        resources.set(id, { ...current, value });
        return true;
      },
    },
  };

  return repository;

  async function visible(
    subject: UserId,
    viewer: UserId | null,
    audience: Profile["audience"],
    cohortScopeId: CohortId | null,
  ) {
    if (viewer === subject) return true;
    const blocked = Boolean(
      viewer &&
      (await repository.moderation.isBlockedEitherWay(subject, viewer)),
    );
    const sameCohort = Boolean(
      viewer &&
      cohortScopeId &&
      (await repository.cohorts.getActiveRole(cohortScopeId, viewer)) &&
      (await repository.cohorts.getActiveRole(cohortScopeId, subject)),
    );
    const suggestedConnection = Boolean(
      viewer &&
      [...pairs.values()].some(
        (pair) =>
          (pair.userAId === subject && pair.userBId === viewer) ||
          (pair.userAId === viewer && pair.userBId === subject),
      ),
    );
    const mutualConnection = Boolean(
      viewer &&
      [...connectionMembers.entries()].some(
        ([id, members]) =>
          members.has(subject) &&
          members.has(viewer) &&
          connections.get(id)?.state === "active",
      ),
    );
    return can(
      "read_profile",
      {
        actorId: viewer,
        ownerId: subject,
        blocked,
        sameCohort,
        suggestedConnection,
        mutualConnection,
      },
      audience,
      Boolean(cohortScopeId),
    );
  }

  async function blockedWithAny(actor: UserId, members: Set<UserId>) {
    for (const member of members)
      if (
        member !== actor &&
        (await repository.moderation.isBlockedEitherWay(actor, member))
      )
        return true;
    return false;
  }

  async function canActOnSurface(
    surfaceId: string,
    actorId: UserId,
    action: "member" | "publish",
  ) {
    const surface = surfaces.get(surfaceId);
    if (!surface) return false;
    if (surface.kind === "profile") return surface.ownerUserId === actorId;
    if (surface.kind === "room")
      return (
        action === "member" &&
        repository.rooms.isActiveMember(surface.subjectId as RoomId, actorId)
      );
    if (surface.kind === "circle") {
      const role = await repository.circles.getActiveRole(
        surface.subjectId as CircleId,
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
      return profiles.get(subjectId as ProfileId)?.userId === ownerId;
    if (kind === "room")
      return repository.rooms.isActiveMember(subjectId as RoomId, ownerId);
    return Boolean(
      await repository.circles.getActiveRole(subjectId as CircleId, ownerId),
    );
  }

  async function canReadPublishedSurface(
    surfaceId: string,
    viewerUserId: UserId | null,
  ) {
    const surface = surfaces.get(surfaceId);
    if (!surface) return false;
    if (surface.kind === "profile")
      return Boolean(
        await repository.profiles.findByIdForViewer(
          surface.subjectId as ProfileId,
          viewerUserId,
        ),
      );
    if (surface.kind === "room")
      return Boolean(
        viewerUserId &&
        (await repository.rooms.isActiveMember(
          surface.subjectId as RoomId,
          viewerUserId,
        )),
      );
    return Boolean(
      await repository.circles.getActiveRole(
        surface.subjectId as CircleId,
        viewerUserId,
      ),
    );
  }

  function hasAppealStanding(report: ReportRecord, actorId: UserId) {
    if (report.reporterUserId === actorId) return true;
    if (report.targetKind === "user") return report.targetId === actorId;
    if (report.targetKind === "profile")
      return profiles.get(report.targetId as ProfileId)?.userId === actorId;
    if (report.targetKind === "project")
      return (
        projects.get(report.targetId as ProjectId)?.ownerUserId === actorId
      );
    if (report.targetKind === "work_signal")
      return signals.get(report.targetId)?.userId === actorId;
    return false;
  }
}

function parseRevisionSpec(specJson: string, expectedVersion?: string, forRevisionCreation = false) {
  return parseSurfaceSpecJson(specJson, expectedVersion, { forRevisionCreation });
}

function createMemoryIdempotency(
  records: Map<
    string,
    {
      id: string;
      requestHash: string;
      status: string;
      responseJson: string | null;
      expiresAt: Date;
    }
  >,
  byId: Map<string, string>,
): IdempotencyRepository {
  return {
    async begin(input) {
      if (input.expiresAt <= input.at)
        throw new Error("idempotency_invalid_expiry");
      const key = `${input.actorUserId}\0${input.operation}\0${input.keyHash}`;
      const existing = records.get(key);
      if (existing && existing.expiresAt > input.at)
        return existing.requestHash === input.requestHash
          ? { status: "replay", responseJson: existing.responseJson }
          : { status: "conflict" };
      if (existing) byId.delete(existing.id);
      records.set(key, {
        id: input.id,
        requestHash: input.requestHash,
        status: "processing",
        responseJson: null,
        expiresAt: input.expiresAt,
      });
      byId.set(input.id, key);
      return { status: "acquired" };
    },
    async complete(id, actorUserId, responseJson) {
      const key = byId.get(id);
      const value = key ? records.get(key) : null;
      if (
        !value ||
        value.status !== "processing" ||
        !key?.startsWith(`${actorUserId}\0`)
      )
        return false;
      value.status = "complete";
      value.responseJson = responseJson;
      return true;
    },
  };
}

function requireUser(users: Map<UserId, User>, id: UserId) {
  if (!users.has(id)) throw new Error("user_not_found");
}
function assertSelf(
  users: Map<UserId, User>,
  actorId: UserId,
  targetId: UserId,
) {
  requireUser(users, actorId);
  requireUser(users, targetId);
  if (actorId !== targetId) throw new Error("forbidden");
}
function memberKey(groupId: string, userId: UserId) {
  return `${groupId}\0${userId}`;
}
function blockKey(a: UserId, b: UserId) {
  return `${a}\0${b}`;
}
function unique<K, V>(map: Map<K, V>, key: K, value: V, error: string) {
  if (map.has(key)) throw new Error(error);
  map.set(key, clone(value));
}
function uniqueSet(set: Set<string>, key: string) {
  if (set.has(key)) throw new Error("conflict");
  set.add(key);
}
function isAdmin(role: "member" | "admin" | "owner" | null) {
  return role === "admin" || role === "owner";
}
function isOperator(user: User | undefined) {
  return user?.operatorRole === "moderator" || user?.operatorRole === "admin";
}
function clone<T>(value: T): T {
  return value === null ? value : structuredClone(value);
}
