import type { Audience, Cohort, MemberRole, Profile, User } from "./types";
import type {
  CircleId,
  CohortId,
  ConnectionId,
  ProfileId,
  ProjectId,
  RoomId,
  UserId,
} from "./ids";

export type PrivateResource = {
  id: string;
  ownerUserId: UserId;
  value: string;
  createdAt: Date;
};

export interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
}

export interface ProfileRepository {
  create(profile: Profile & { actorId: UserId }): Promise<void>;
  findByIdForViewer(
    id: ProfileId,
    viewerId: UserId | null,
  ): Promise<Profile | null>;
}

export interface PrivateResourceRepository {
  create(resource: PrivateResource & { actorId: UserId }): Promise<void>;
  readForOwner(
    id: string,
    actorUserId: UserId,
  ): Promise<PrivateResource | null>;
  updateForOwner(
    id: string,
    actorUserId: UserId,
    value: string,
  ): Promise<boolean>;
}

export interface CohortRepository {
  create(
    cohort: Cohort & {
      actorId: UserId;
      name: string;
      description: string;
      communityCreated: boolean;
    },
  ): Promise<void>;
  findByIdForViewer(
    id: CohortId,
    viewerUserId: UserId | null,
  ): Promise<
    | (Cohort & {
        name: string;
        description: string;
        communityCreated: boolean;
      })
    | null
  >;
  setMembership(input: {
    actorId: UserId;
    cohortId: CohortId;
    userId: UserId;
    role: MemberRole;
    status:
      "requested" | "invited" | "active" | "declined" | "removed" | "left";
  }): Promise<void>;
  transferOwnership(input: {
    actorId: UserId;
    cohortId: CohortId;
    newOwnerUserId: UserId;
    demoteOldOwnerTo: "admin" | "member";
  }): Promise<void>;
  getActiveRole(cohortId: CohortId, userId: UserId): Promise<MemberRole | null>;
  createInvitation(
    input: CohortInvitation & { actorId: UserId },
  ): Promise<void>;
  respondToInvitation(
    id: string,
    actorId: UserId,
    decision: "accepted" | "declined",
    at: Date,
  ): Promise<{ cohortId: CohortId; membershipActivated: boolean } | null>;
}

export type ConnectedAppPreference = {
  id: string;
  userId: UserId;
  appId: string;
  displayName: string;
  category: string;
  accessMode: "never" | "ask_each_time" | "approved_summaries";
  lastReviewedAt: Date;
};
export interface ConnectedAppRepository {
  save(value: ConnectedAppPreference & { actorId: UserId }): Promise<void>;
  listForUser(userId: UserId): Promise<ConnectedAppPreference[]>;
}

export type WorkSignalRecord = {
  id: string;
  userId: UserId;
  taxonomyVersionId: string;
  summary: string;
  audience: Audience;
  cohortScopeId: CohortId | null;
  allowMatching: boolean;
  expiresAt: Date;
  createdAt: Date;
};
export interface WorkSignalRepository {
  create(value: WorkSignalRecord & { actorId: UserId }): Promise<void>;
  listVisible(
    subjectUserId: UserId,
    viewerUserId: UserId | null,
    at: Date,
  ): Promise<WorkSignalRecord[]>;
}

export type ProjectRecord = {
  id: ProjectId;
  ownerUserId: UserId;
  slug: string;
  title: string;
  summary: string;
  audience: Audience;
  cohortScopeId: CohortId | null;
  allowMatching: boolean;
  status: "draft" | "active" | "archived" | "deleted";
  createdAt: Date;
};
export interface ProjectRepository {
  create(value: ProjectRecord & { actorId: UserId }): Promise<void>;
  findVisible(
    id: ProjectId,
    viewerUserId: UserId | null,
  ): Promise<ProjectRecord | null>;
  setCollaborator(input: {
    actorId: UserId;
    projectId: ProjectId;
    userId: UserId;
    role: "viewer" | "editor" | "owner";
    approvedAt: Date | null;
  }): Promise<void>;
  getCollaboratorRole(
    projectId: ProjectId,
    userId: UserId,
  ): Promise<"viewer" | "editor" | "owner" | null>;
  canEdit(projectId: ProjectId, actorId: UserId): Promise<boolean>;
}
export interface TaxonomyRepository {
  createVersion(input: {
    id: string;
    version: number;
    status: "draft" | "active" | "retired";
    at: Date;
  }): Promise<void>;
  createTopic(input: {
    id: string;
    taxonomyVersionId: string;
    slug: string;
    label: string;
  }): Promise<void>;
}

export type InviteLinkRecord = {
  id: string;
  creatorUserId: UserId;
  tokenHash: string;
  kind: "personal" | "cohort_admin" | "builder" | "connection_card";
  maximumUses: number;
  expiresAt: Date;
  createdAt: Date;
};
export type ConnectionCardRecord = {
  id: string;
  creatorUserId: UserId;
  projectId: ProjectId | null;
  headline: string;
  tokenHash: string;
  maximumUses: number;
  expiresAt: Date;
  createdAt: Date;
};
export interface InviteRepository {
  createLink(value: InviteLinkRecord & { actorId: UserId }): Promise<void>;
  consumeLink(tokenHash: string, at: Date): Promise<boolean>;
  createConnectionCard(
    value: ConnectionCardRecord & { actorId: UserId },
  ): Promise<void>;
  consumeConnectionCard(
    tokenHash: string,
    at: Date,
  ): Promise<{
    id: string;
    creatorUserId: UserId;
    projectId: ProjectId | null;
    headline: string;
  } | null>;
}
export type CohortInvitation = {
  id: string;
  cohortId: CohortId;
  inviterUserId: UserId;
  inviteeUserId: UserId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type SurfaceRevisionRecord = {
  id: string;
  surfaceId: string;
  authorUserId: UserId;
  revisionNumber: number;
  baseRevisionNumber: number | null;
  designPolicyId: string;
  designPolicyVersion: string;
  specJson: string;
  createdAt: Date;
};
export interface SurfaceRepository {
  createPolicy(input: {
    id: string;
    version: string;
    sourceHash: string;
    policyJson: string;
    activatedAt: Date;
    at: Date;
  }): Promise<void>;
  createSurface(input: {
    actorId: UserId;
    id: string;
    ownerUserId: UserId;
    kind: "profile" | "room" | "circle";
    subjectId: string;
    at: Date;
  }): Promise<void>;
  createRevision(
    value: SurfaceRevisionRecord & { actorId: UserId },
  ): Promise<void>;
  findRevisionForViewer(
    id: string,
    viewerUserId: UserId | null,
  ): Promise<SurfaceRevisionRecord | null>;
  decideRevision(input: {
    actorId: UserId;
    revisionId: string;
    governanceVersion: number;
    decision: "approved" | "rejected";
    at: Date;
  }): Promise<void>;
  publishRevision(input: {
    actorId: UserId;
    surfaceId: string;
    revisionId: string;
    expectedPublishedRevisionNumber: number | null;
    governanceVersion: number;
    proposalId?: string;
    at: Date;
  }): Promise<void>;
  setPersonalView(input: {
    actorId: UserId;
    id: string;
    surfaceId: string;
    revisionId: string;
    at: Date;
  }): Promise<void>;
  addAsset(input: {
    actorId: UserId;
    id: string;
    ownerUserId: UserId;
    objectKey: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    at: Date;
  }): Promise<void>;
}

export type MatchPairRecord = {
  id: string;
  userAId: UserId;
  userBId: UserId;
  createdAt: Date;
};
export interface MatchingRepository {
  upsertBuilderIndex(input: {
    actorId: UserId;
    userId: UserId;
    version: number;
    taxonomyVersionId: string;
    topicsJson: string;
    at: Date;
  }): Promise<void>;
  recordPairScore(input: {
    id: string;
    userAId: UserId;
    userBId: UserId;
    indexVersionA: number;
    indexVersionB: number;
    taxonomyVersion: number;
    weightVersion: number;
    totalBasisPoints: number;
    expiresAt: Date;
    at: Date;
  }): Promise<void>;
  createCandidateBatch(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    indexVersion: number;
    taxonomyVersion: number;
    candidateIdsJson: string;
    expiresAt: Date;
    at: Date;
  }): Promise<void>;
  createPair(value: MatchPairRecord): Promise<void>;
  findPair(id: string): Promise<MatchPairRecord | null>;
  recordEvaluation(input: {
    actorId: UserId;
    id: string;
    proposalId: string;
    userId: UserId;
    decision: "approve" | "decline" | "defer";
    reasonSummary: string;
    indexVersion: number;
    at: Date;
  }): Promise<void>;
  recordHumanResponse(input: {
    actorId: UserId;
    id: string;
    proposalId: string;
    userId: UserId;
    response: "interested" | "decline";
    at: Date;
  }): Promise<void>;
  recordMatchedProposal(input: {
    proposalId: string;
    matchId: string;
    pairId: string;
    acceptanceModeA: "manual" | "full_autopilot";
    acceptanceModeB: "manual" | "full_autopilot";
    expiresAt: Date;
    at: Date;
  }): Promise<void>;
}

export type ConnectionRecord = {
  id: ConnectionId;
  matchPairId: string;
  matchId: string;
  state: "active" | "ended" | "blocked";
  createdAt: Date;
};
export interface ConnectionRepository {
  createFromMatch(input: {
    id: ConnectionId;
    matchId: string;
    expectedMatchPairId: string;
    at: Date;
  }): Promise<ConnectionRecord>;
  findForMember(
    id: ConnectionId,
    actorUserId: UserId,
  ): Promise<ConnectionRecord | null>;
  updateSide(input: {
    actorId: UserId;
    connectionId: ConnectionId;
    userId: UserId;
    muted: boolean;
    renewedRelevanceEnabled: boolean;
    at: Date;
  }): Promise<void>;
  savePrivateNote(input: {
    actorId: UserId;
    id: string;
    connectionId: ConnectionId;
    ownerUserId: UserId;
    body: string;
    at: Date;
  }): Promise<void>;
  readPrivateNote(id: string, ownerUserId: UserId): Promise<string | null>;
  scheduleReminder(input: {
    actorId: UserId;
    id: string;
    connectionId: ConnectionId;
    userId: UserId;
    remindAt: Date;
    at: Date;
  }): Promise<void>;
  setUpdateSubscription(input: {
    actorId: UserId;
    connectionId: ConnectionId;
    subscriberUserId: UserId;
    subjectUserId: UserId;
    enabled: boolean;
    at: Date;
  }): Promise<void>;
  requestReconnect(input: {
    actorId: UserId;
    id: string;
    connectionId: ConnectionId;
    requesterUserId: UserId;
    at: Date;
  }): Promise<void>;
}

export type MessageRecord = {
  id: string;
  roomId: RoomId;
  senderUserId: UserId;
  clientMessageId: string;
  body: string;
  createdAt: Date;
};
export interface RoomRepository {
  createForConnection(input: {
    id: RoomId;
    connectionId: ConnectionId;
    expectedMatchPairId: string;
    at: Date;
  }): Promise<void>;
  isActiveMember(id: RoomId, actorUserId: UserId): Promise<boolean>;
  sendMessage(value: MessageRecord & { actorId: UserId }): Promise<void>;
  listMessages(id: RoomId, actorUserId: UserId): Promise<MessageRecord[]>;
  submitFeedback(input: {
    actorId: UserId;
    id: string;
    connectionId: ConnectionId;
    userId: UserId;
    useful: boolean;
    reasonsJson: string;
    at: Date;
  }): Promise<void>;
  proposeUpgrade(input: {
    actorId: UserId;
    id: string;
    roomId: RoomId;
    proposerUserId: UserId;
    modulesJson: string;
    explanation: string;
    at: Date;
  }): Promise<void>;
}

export interface CircleRepository {
  create(input: {
    actorId: UserId;
    id: CircleId;
    name: string;
    purpose: string;
    governanceMode: "admin" | "vote";
    at: Date;
  }): Promise<void>;
  setMembership(input: {
    actorId: UserId;
    circleId: CircleId;
    userId: UserId;
    role: MemberRole;
    status: "invited" | "accepted" | "declined" | "active" | "left" | "removed";
  }): Promise<void>;
  transferOwnership(input: {
    actorId: UserId;
    circleId: CircleId;
    newOwnerUserId: UserId;
    demoteOldOwnerTo: "admin" | "member";
  }): Promise<void>;
  getActiveRole(
    id: CircleId,
    actorUserId: UserId | null,
  ): Promise<MemberRole | null>;
  createProposal(input: {
    actorId: UserId;
    id: string;
    circleId: CircleId;
    kind: "design" | "module" | "rules" | "membership";
    payloadJson: string;
    governanceVersion: number;
    at: Date;
  }): Promise<void>;
  vote(input: {
    actorId: UserId;
    proposalId: string;
    vote: "approve" | "reject" | "abstain";
    at: Date;
  }): Promise<void>;
  addModule(input: {
    actorId: UserId;
    id: string;
    circleId: CircleId;
    kind:
      | "resource_shelf"
      | "experiment_tracker"
      | "decision_log"
      | "feedback_queue"
      | "milestone_tracker"
      | "scoreboard";
    configJson: string;
    at: Date;
  }): Promise<void>;
  addMetric(input: {
    actorId: UserId;
    id: string;
    circleId: CircleId;
    name: string;
    ruleJson: string;
    at: Date;
  }): Promise<void>;
  recordMetric(input: {
    actorId: UserId;
    id: string;
    metricId: string;
    value: number;
    periodKey: string;
    at: Date;
  }): Promise<void>;
}

export interface NetworkingRepository {
  savePulse(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    intentSummary: string;
    startsAt: Date;
    expiresAt: Date;
    at: Date;
  }): Promise<void>;
  setBudget(input: {
    actorId: UserId;
    userId: UserId;
    maximumPerWeek: number;
    weekStartedAt: Date;
  }): Promise<void>;
  addQuietHours(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    timezone: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
  }): Promise<void>;
  snooze(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    startsAt: Date;
    endsAt: Date;
    at: Date;
  }): Promise<void>;
  exclude(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    kind: "user" | "company" | "industry" | "topic" | "cluster";
    normalizedValue: string;
    at: Date;
  }): Promise<void>;
  watch(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    kind: "topic" | "project" | "cohort" | "relevant_builder";
    targetId: string;
    at: Date;
  }): Promise<void>;
  follow(input: {
    actorId: UserId;
    userId: UserId;
    targetKind: "profile" | "project" | "topic" | "cohort";
    targetId: string;
    at: Date;
  }): Promise<void>;
}

export interface AutomationRepository {
  checkpoint(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    kind: string;
    cursor: string | null;
    stateJson: string;
    at: Date;
  }): Promise<void>;
  getCheckpoint(
    userId: UserId,
    kind: string,
  ): Promise<{ cursor: string | null; stateJson: string } | null>;
}

export type NotificationRecord = {
  id: string;
  userId: UserId;
  kind: string;
  delivery: "immediate" | "digest";
  payloadJson: string;
  createdAt: Date;
};
export interface NotificationRepository {
  enqueue(value: NotificationRecord): Promise<void>;
  listForUser(userId: UserId): Promise<NotificationRecord[]>;
}

export type ReportRecord = {
  id: string;
  reporterUserId: UserId;
  targetKind: string;
  targetId: string;
  reasonCode: string;
  status: "received" | "reviewing" | "actioned" | "closed";
  createdAt: Date;
};
export interface ModerationRepository {
  createReport(value: ReportRecord & { actorId: UserId }): Promise<void>;
  findForReporter(
    id: string,
    reporterUserId: UserId,
  ): Promise<ReportRecord | null>;
  openCase(input: {
    actorId: UserId;
    id: string;
    reportId: string;
    at: Date;
  }): Promise<void>;
  recordAction(input: {
    actorId: UserId;
    id: string;
    caseId: string;
    action: string;
    reasonCode: string;
    at: Date;
  }): Promise<void>;
  appeal(input: {
    actorId: UserId;
    id: string;
    caseId: string;
    statement: string;
    at: Date;
  }): Promise<void>;
  queueRedaction(input: {
    actorId: UserId;
    id: string;
    sourceKind: string;
    sourceId: string;
    at: Date;
  }): Promise<void>;
  block(input: {
    actorId: UserId;
    blockerUserId: UserId;
    blockedUserId: UserId;
    at: Date;
  }): Promise<void>;
  isBlockedEitherWay(a: UserId, b: UserId): Promise<boolean>;
}
export interface LifecycleRepository {
  requestExport(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    at: Date;
  }): Promise<void>;
  requestDeletion(input: {
    actorId: UserId;
    id: string;
    userId: UserId;
    at: Date;
  }): Promise<void>;
  getJob(
    id: string,
    userId: UserId,
  ): Promise<{
    id: string;
    kind: "export" | "deletion";
    status: string;
  } | null>;
}
export type IdempotencyBeginResult =
  | { status: "acquired" }
  | { status: "replay"; responseJson: string | null }
  | { status: "conflict" };
export interface IdempotencyRepository {
  begin(input: {
    id: string;
    actorUserId: UserId;
    operation: string;
    keyHash: string;
    requestHash: string;
    expiresAt: Date;
    at: Date;
  }): Promise<IdempotencyBeginResult>;
  complete(
    id: string,
    actorUserId: UserId,
    responseJson: string,
    at: Date,
  ): Promise<boolean>;
}
export type AuditRecord = {
  id: string;
  actorUserId: UserId | null;
  action: string;
  objectKind: string;
  objectId: string;
  metadataJson: string;
  createdAt: Date;
};
export interface AuditRepository {
  append(value: AuditRecord): Promise<void>;
  listForObject(kind: string, id: string): Promise<AuditRecord[]>;
}

export interface BuildmatesRepositories {
  users: UserRepository;
  profiles: ProfileRepository;
  cohorts: CohortRepository;
  connectedApps: ConnectedAppRepository;
  workSignals: WorkSignalRepository;
  taxonomy: TaxonomyRepository;
  projects: ProjectRepository;
  networking: NetworkingRepository;
  invites: InviteRepository;
  surfaces: SurfaceRepository;
  matching: MatchingRepository;
  connections: ConnectionRepository;
  rooms: RoomRepository;
  circles: CircleRepository;
  notifications: NotificationRepository;
  automation: AutomationRepository;
  moderation: ModerationRepository;
  lifecycle: LifecycleRepository;
  idempotency: IdempotencyRepository;
  audit: AuditRepository;
  privateResources: PrivateResourceRepository;
}
