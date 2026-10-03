import { createD1Repositories } from "@buildmates/database";
import { getSetupState, SETUP_STEPS, type SetupStep } from "@buildmates/domain";
import type { D1Like } from "./d1";
import type { R2Like } from "./r2";
import { findValidPrivateProfilePreview } from "./profile-surface-preview";
import {
  changeProjectLifecycle,
  normalizeHandle,
  publishProfile,
  saveProfile,
} from "../profile-projects/service";
import { beginAccountDeletion } from "../privacy/account-deletion";

export type SourcePolicy =
  "never" | "ask_each_time" | "allow_approved_work_signals" | "actions_only";
export type Audience =
  | "public"
  | "signed_in"
  | "suggested_connections"
  | "mutual_connections"
  | "private";
export type AcceptanceMode = "manual" | "full_autopilot";
export type AutomationCadence =
  "automatic" | "daily" | "twice_weekly" | "weekly" | "manual";

export type OnboardingSnapshot = {
  generatedAt: string;
  setup: ReturnType<typeof getSetupState>;
  codexConnected: boolean;
  sources: Array<{
    id: string;
    appId: string;
    displayName: string;
    category: string;
    accessMode: SourcePolicy;
    lastReviewedAt: string;
    latestSignal: string | null;
  }>;
  signals: Array<{
    id: string;
    sourceAppId: string | null;
    sourceDisplayName: string;
    summary: string;
    audience: Audience;
    allowMatching: boolean;
    expiresAt: string;
    revokedAt: string | null;
    status: "available" | "stale" | "revoked";
  }>;
  profile: null | {
    id: string;
    handle: string | null;
    displayName: string;
    summary: string;
    projectOrInterest: string;
    portfolioLinks: string[];
    audience: Audience;
    allowMatching: boolean;
    acceptanceMode: AcceptanceMode;
    publishedAt: string | null;
  };
  profilePreview: null | {
    revisionId: string;
    revisionNumber: number;
  };
  networking: null | {
    id: string;
    intentSummary: string;
    similarAdjacent: number;
    localGlobal: number;
    serendipity: number;
    startsAt: string;
    expiresAt: string;
    controls: NetworkingControls;
    expired: boolean;
  };
  automation: null | {
    cadence: AutomationCadence;
    enabled: boolean;
    state: string;
    sourceLivenessReviewed: boolean;
    capability: "available" | "approval_required" | "automation_unavailable";
    hostTaskConfirmed: false;
    backgroundExecutionVerified: false;
    updatedAt: string;
  };
  lifecycle: Array<{
    id: string;
    kind: "export" | "deletion";
    status: string;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    objectKind: string;
    objectId: string;
    createdAt: string;
  }>;
  holdings: {
    projects: number;
    rooms: number;
    circles: number;
    evaluations: number;
    notifications: number;
  };
  projects: Array<{
    slug: string;
    title: string;
    status: string;
    audience: Audience;
    updatedAt: string;
  }>;
};

export type NetworkingControls = {
  builderSimilarity: "similar" | "adjacent" | "balanced";
  geography: "local" | "global" | "balanced";
  maximumIntroductionsPerWeek: number;
  timezone: string;
  quietStart: string;
  quietEnd: string;
  snoozedUntil: string | null;
  exclusions: string[];
  avoidRepeatedClusters: boolean;
};

type DB = D1Database & D1Like;

export async function getOnboardingSnapshot(
  DB: DB,
  userId: string,
  displayName: string | null,
): Promise<OnboardingSnapshot> {
  const now = Date.now();
  await ensureUser(DB, userId);
  const codexConnected = await synchronizeIdentityLinkStep(DB, userId, now);
  const [
    setupRow,
    sourceResult,
    signalResult,
    profileRow,
    pulseRow,
    automationRow,
    lifecycleResult,
    auditResult,
    holdings,
    quietResult,
    snoozeRow,
    exclusionResult,
    projectResult,
  ] = await Promise.all([
    DB.prepare(
      "SELECT completed_steps_json AS completedStepsJson, updated_at AS updatedAt FROM setup_states WHERE user_id=?",
    )
      .bind(userId)
      .first<{ completedStepsJson: string; updatedAt: number }>(),
    DB.prepare(
      "SELECT p.id,p.app_id AS appId,p.display_name AS displayName,p.category,p.access_mode AS accessMode,p.last_reviewed_at AS lastReviewedAt,(SELECT w.free_text_summary FROM work_signals w WHERE w.user_id=p.user_id AND w.source_app_id=p.app_id AND w.revoked_at IS NULL ORDER BY w.updated_at DESC LIMIT 1) AS latestSignal FROM connected_app_preferences p WHERE p.user_id=? AND p.revoked_at IS NULL ORDER BY p.display_name LIMIT 50",
    )
      .bind(userId)
      .all(),
    DB.prepare(
      "SELECT w.id,w.source_app_id AS sourceAppId,COALESCE(p.display_name,CASE WHEN w.source_app_id IS NULL THEN 'Manual entry' ELSE w.source_app_id END) AS sourceDisplayName,w.free_text_summary AS summary,w.audience,w.allow_matching AS allowMatching,w.expires_at AS expiresAt,w.revoked_at AS revokedAt FROM work_signals w LEFT JOIN connected_app_preferences p ON p.user_id=w.user_id AND p.app_id=w.source_app_id WHERE w.user_id=? ORDER BY w.updated_at DESC LIMIT 100",
    )
      .bind(userId)
      .all(),
    DB.prepare(
      "SELECT p.id,h.handle,p.display_name AS displayName,p.summary,p.project_or_interest AS projectOrInterest,p.portfolio_links_json AS portfolioLinksJson,p.audience,p.allow_matching AS allowMatching,p.acceptance_mode AS acceptanceMode,p.published_at AS publishedAt FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.user_id=? LIMIT 1",
    )
      .bind(userId)
      .first<Record<string, unknown>>(),
    DB.prepare(
      "SELECT id,intent_summary AS intentSummary,similar_adjacent AS similarAdjacent,local_global AS localGlobal,serendipity,controls_json AS controlsJson,starts_at AS startsAt,expires_at AS expiresAt FROM networking_pulses WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(userId)
      .first<Record<string, unknown>>(),
    DB.prepare(
      "SELECT state_json AS stateJson,updated_at AS updatedAt FROM automation_checkpoints WHERE user_id=? AND kind='buildmates' LIMIT 1",
    )
      .bind(userId)
      .first<{ stateJson: string; updatedAt: number }>(),
    DB.prepare(
      "SELECT id,'export' AS kind,status,created_at AS createdAt FROM export_jobs WHERE user_id=? UNION ALL SELECT id,'deletion' AS kind,status,requested_at AS createdAt FROM deletion_jobs WHERE user_id=? ORDER BY createdAt DESC LIMIT 20",
    )
      .bind(userId, userId)
      .all(),
    DB.prepare(
      "SELECT id,action,object_kind AS objectKind,object_id AS objectId,created_at AS createdAt FROM audit_events WHERE actor_user_id=? ORDER BY created_at DESC LIMIT 50",
    )
      .bind(userId)
      .all(),
    DB.prepare(
      "SELECT (SELECT COUNT(*) FROM projects WHERE owner_user_id=? AND status<>'deleted') AS projects,(SELECT COUNT(*) FROM room_memberships WHERE user_id=? AND left_at IS NULL) AS rooms,(SELECT COUNT(*) FROM circle_memberships WHERE user_id=? AND status IN ('accepted','active')) AS circles,(SELECT COUNT(*) FROM codex_evaluations WHERE user_id=?) AS evaluations,(SELECT COUNT(*) FROM notifications WHERE user_id=?) AS notifications",
    )
      .bind(userId, userId, userId, userId, userId)
      .first<{ projects: number; rooms: number; circles: number; evaluations: number; notifications: number }>(),
    DB.prepare("SELECT start_minute AS startMinute,end_minute AS endMinute,timezone FROM quiet_hours WHERE user_id=? ORDER BY weekday,start_minute LIMIT 14").bind(userId).all(),
    DB.prepare("SELECT ends_at AS endsAt FROM matching_snoozes WHERE user_id=? AND starts_at<=? AND ends_at>? ORDER BY ends_at DESC LIMIT 1").bind(userId,now,now).first<{endsAt:number}>(),
    DB.prepare("SELECT kind,normalized_value AS normalizedValue FROM matching_exclusions WHERE user_id=? ORDER BY kind,normalized_value LIMIT 100").bind(userId).all(),
    DB.prepare("SELECT slug,title,status,audience,updated_at AS updatedAt FROM projects WHERE owner_user_id=? AND status<>'deleted' ORDER BY updated_at DESC LIMIT 100").bind(userId).all(),
  ]);

  const completedSteps = safeStringArray(
    setupRow?.completedStepsJson ?? "[]",
  ) as SetupStep[];
  const setup = getSetupState({
    completedSteps,
    updatedAt: setupRow
      ? new Date(setupRow.updatedAt).toISOString()
      : new Date(0).toISOString(),
  });
  const automationState = automationRow
    ? safeObject(automationRow.stateJson)
    : null;
  const profilePreview = await findValidPrivateProfilePreview(DB, userId);
  const sourceRows = sourceResult.results as Array<Record<string, unknown>>;
  const signalRows = signalResult.results as Array<Record<string, unknown>>;
  const lifecycleRows = lifecycleResult.results as Array<
    Record<string, unknown>
  >;
  const auditRows = auditResult.results as Array<Record<string, unknown>>;

  return {
    generatedAt: iso(now),
    setup,
    codexConnected,
    sources: sourceRows.map((row) => ({
      id: String(row.id),
      appId: String(row.appId),
      displayName: String(row.displayName),
      category: String(row.category),
      accessMode: row.accessMode as SourcePolicy,
      lastReviewedAt: iso(Number(row.lastReviewedAt)),
      latestSignal: row.latestSignal ? String(row.latestSignal) : null,
    })),
    signals: signalRows.map((row) => {
      const revokedAt =
        row.revokedAt == null ? null : iso(Number(row.revokedAt));
      const expiresAt = iso(Number(row.expiresAt));
      return {
        id: String(row.id),
        sourceAppId: row.sourceAppId ? String(row.sourceAppId) : null,
        sourceDisplayName: String(row.sourceDisplayName),
        summary: String(row.summary),
        audience: row.audience as Audience,
        allowMatching: Boolean(row.allowMatching),
        expiresAt,
        revokedAt,
        status: revokedAt
          ? "revoked"
          : Number(row.expiresAt) <= now
            ? "stale"
            : "available",
      };
    }),
    profile: profileRow
      ? {
          id: String(profileRow.id),
          handle: profileRow.handle ? String(profileRow.handle) : null,
          displayName: String(
            profileRow.displayName || displayName || "Builder",
          ),
          summary: String(profileRow.summary),
          projectOrInterest: String(profileRow.projectOrInterest),
          portfolioLinks: safeStringArray(
            String(profileRow.portfolioLinksJson),
          ),
          audience: profileRow.audience as Audience,
          allowMatching: Boolean(profileRow.allowMatching),
          acceptanceMode: profileRow.acceptanceMode as AcceptanceMode,
          publishedAt: profileRow.publishedAt == null ? null : iso(Number(profileRow.publishedAt)),
        }
      : null,
    profilePreview: profilePreview
      ? {
          revisionId: profilePreview.revisionId,
          revisionNumber: profilePreview.revisionNumber,
        }
      : null,
    networking: pulseRow
      ? {
          id: String(pulseRow.id),
          intentSummary: String(pulseRow.intentSummary),
          similarAdjacent: Number(pulseRow.similarAdjacent),
          localGlobal: Number(pulseRow.localGlobal),
          serendipity: Number(pulseRow.serendipity),
          startsAt: iso(Number(pulseRow.startsAt)),
          expiresAt: iso(Number(pulseRow.expiresAt)),
          controls: canonicalControls(
            safeObject(String(pulseRow.controlsJson)),
            quietResult.results as Array<Record<string, unknown>>,
            snoozeRow?.endsAt ?? null,
            exclusionResult.results as Array<Record<string, unknown>>,
          ),
          expired: Number(pulseRow.expiresAt) <= now,
        }
      : null,
    automation:
      automationRow && automationState
        ? {
            cadence: readCadence(automationState.cadence),
            enabled: Boolean(automationState.enabled),
            state: automationState.enabled && readCadence(automationState.cadence) !== "manual" ? "requested" : "disabled",
            hostTaskConfirmed: false,
            backgroundExecutionVerified: false,
            sourceLivenessReviewed: Boolean(
              automationState.sourceLivenessReviewed,
            ),
            capability: readCapability(automationState.capability),
            updatedAt: iso(automationRow.updatedAt),
          }
        : null,
    lifecycle: lifecycleRows.map((row) => ({
      id: String(row.id),
      kind: row.kind as "export" | "deletion",
      status: String(row.status),
      createdAt: iso(Number(row.createdAt)),
    })),
    audit: auditRows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      objectKind: String(row.objectKind),
      objectId: String(row.objectId),
      createdAt: iso(Number(row.createdAt)),
    })),
    holdings: {
      projects: Number(holdings?.projects ?? 0),
      rooms: Number(holdings?.rooms ?? 0),
      circles: Number(holdings?.circles ?? 0),
      evaluations: Number(holdings?.evaluations ?? 0),
      notifications: Number(holdings?.notifications ?? 0),
    },
    projects: (projectResult.results as Array<Record<string, unknown>>).map((row) => ({
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      audience: row.audience as Audience,
      updatedAt: iso(Number(row.updatedAt)),
    })),
  };
}

export async function saveSourcePolicies(
  DB: DB,
  userId: string,
  sources: Array<{
    appId: string;
    displayName: string;
    category: string;
    accessMode: SourcePolicy;
  }>,
  completeStep = false,
): Promise<void> {
  await ensureUser(DB, userId);
  await synchronizeIdentityLinkStep(DB, userId, Date.now());
  if (sources.length > 50) throw new InputError("Too many sources.");
  if (!sources.length) {
    if (!completeStep)
      throw new InputError(
        "Add a source or continue setup without connected sources.",
      );
    await audit(
      DB,
      userId,
      "source_policies.reviewed_empty",
      "user",
      userId,
      {},
    );
    await completeStepInOrder(DB, userId, "source_selection");
    return;
  }
  const now = Date.now();
  const statements = sources.map((source) => {
    const appId = identifier(source.appId, "source identifier");
    const displayName = text(source.displayName, 1, 80, "source name");
    const category = text(source.category, 1, 80, "source category");
    if (
      ![
        "never",
        "ask_each_time",
        "allow_approved_work_signals",
        "actions_only",
      ].includes(source.accessMode)
    )
      throw new InputError("Invalid source policy.");
    return DB.prepare(
      "INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL) ON CONFLICT(user_id,app_id) DO UPDATE SET display_name=excluded.display_name,category=excluded.category,access_mode=excluded.access_mode,last_reviewed_at=excluded.last_reviewed_at,revoked_at=NULL",
    ).bind(
      `src_${stableIdSuffix(userId, appId)}`,
      userId,
      appId,
      displayName,
      category,
      source.accessMode,
      now,
    );
  });
  await DB.batch(statements);
  await audit(DB, userId, "source_policies.saved", "user", userId, {
    count: sources.length,
  });
  if (completeStep) await completeStepInOrder(DB, userId, "source_selection");
}

export async function revokeSource(
  DB: DB,
  userId: string,
  appId: string,
  at = Date.now(),
): Promise<void> {
  const now = at;
  const result = await DB.batch([
    DB.prepare(
      "UPDATE connected_app_preferences SET access_mode='never',revoked_at=?,last_reviewed_at=? WHERE user_id=? AND app_id=? AND revoked_at IS NULL",
    ).bind(now, now, userId, appId),
    DB.prepare(
      "UPDATE work_signals SET revoked_at=?,updated_at=? WHERE user_id=? AND source_app_id=? AND revoked_at IS NULL",
    ).bind(now, now, userId, appId),
    ...matchingInvalidationStatements(DB, userId, now),
  ]);
  if (!result[0].meta.changes) throw new NotFoundError();
  await audit(DB, userId, "source.revoked", "connected_app", appId, {}, now);
}

export async function mutateOnboarding(
  DB: DB,
  userId: string,
  displayName: string | null,
  body: Record<string, unknown>,
): Promise<void> {
  const action = String(body.action ?? "");
  await ensureUser(DB, userId);
  await synchronizeIdentityLinkStep(DB, userId, Date.now());
  if (action === "acknowledge_storage") {
    if (body.acknowledged !== true)
      throw new InputError("Acknowledge the storage boundary to continue.");
    await completeStepInOrder(DB, userId, "storage_explanation");
    return audit(DB, userId, "setup.storage_acknowledged", "user", userId, {});
  }
  if (action === "save_context") {
    const method = text(body.method, 1, 40, "context method");
    if (
      ![
        "connected_context",
        "manual_profile",
        "repository",
        "project",
        "pasted_description",
        "portfolio_links",
      ].includes(method)
    )
      throw new InputError("Invalid context method.");
    const summary = text(body.summary, 20, 12000, "builder context");
    const projectOrInterest = text(
      body.projectOrInterest,
      2,
      240,
      "project or active interest",
    );
    const links = urlList(body.links);
    const id = `profile_${stableIdSuffix(userId)}`;
    await DB.prepare(
      "INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,created_at,updated_at) VALUES (?,?,?,?,?,?,'private',0,'manual',0,?,?) ON CONFLICT(user_id) DO UPDATE SET summary=excluded.summary,project_or_interest=excluded.project_or_interest,portfolio_links_json=excluded.portfolio_links_json,updated_at=excluded.updated_at",
    )
      .bind(
        id,
        userId,
        displayName || "Builder",
        summary,
        projectOrInterest,
        JSON.stringify(links),
        Date.now(),
        Date.now(),
      )
      .run();
    await completeStepInOrder(DB, userId, "context_collection");
    return audit(DB, userId, "setup.context_collected", "profile", id, {
      method,
    });
  }
  if (action === "review_signals") {
    const ids = stringList(body.signalIds, 100);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const row = await DB.prepare(
        `SELECT COUNT(*) AS count FROM work_signals WHERE user_id=? AND id IN (${placeholders}) AND revoked_at IS NULL`,
      )
        .bind(userId, ...ids)
        .first<{ count: number }>();
      if (Number(row?.count ?? 0) !== ids.length)
        throw new InputError("One or more signals are unavailable.");
    }
    await completeStepInOrder(DB, userId, "signal_privacy_review");
    return audit(DB, userId, "setup.signal_privacy_reviewed", "user", userId, {
      signalCount: ids.length,
    });
  }
  if (action === "save_profile") {
    let handle: string;
    try {
      handle = normalizeHandle(String(body.handle ?? ""));
    } catch {
      throw new InputError("Use 3 to 32 lowercase letters, numbers, or underscores for your handle.");
    }
    const name = text(body.displayName, 1, 80, "display name");
    const summary = text(body.summary, 20, 4000, "builder summary");
    const project = text(
      body.projectOrInterest,
      2,
      240,
      "project or active interest",
    );
    const allowMatching = Boolean(body.allowMatching);
    const existing = await DB.prepare("SELECT acceptance_mode AS acceptanceMode FROM profiles WHERE user_id=?").bind(userId).first<{acceptanceMode:AcceptanceMode}>();
    let profileId: string;
    try {
      const saved = await saveProfile(DB,userId,{
        handle,displayName:name,summary,allowMatching,
        acceptanceMode:existing?.acceptanceMode??"manual",
        projectOrInterest:project,
        fields:[{key:"current_work",value:project,audience:"suggested_connections",allowMatching,sourceStatus:"confirmed",provenance:"self_reported"}],
      },{publish:false,preserveExistingDetails:true});
      profileId=saved.profileId;
    } catch (error) {
      if (String(error).includes("UNIQUE") || String(error).includes("handles_normalized_unique"))
        throw new InputError("That handle is already taken.");
      throw error;
    }
    await completeStepInOrder(DB, userId, "basic_profile");
    return audit(DB, userId, "profile.reviewed", "profile", profileId, {
      publication: "private_draft",
      allowMatching,
    });
  }
  if (action === "skip_preview") {
    const profile = await DB.prepare("SELECT id FROM profiles WHERE user_id=?").bind(userId).first<{ id: string }>();
    if (!profile) throw new InputError("Review your profile before continuing.");
    await completeStepInOrder(DB, userId, "page_preview");
    return audit(DB, userId, "profile.page_deferred", "profile", profile.id, {});
  }
  if (action === "approve_preview") {
    const profile = await DB.prepare("SELECT id,audience,allow_matching AS allowMatching FROM profiles WHERE user_id=?")
      .bind(userId)
      .first<{ id: string; audience: Audience; allowMatching: number }>();
    if (!profile || body.approved !== true)
      throw new InputError("Approve the private preview to continue.");
    const revisionId = identifier(body.revisionId, "profile preview revision");
    const preview = await findValidPrivateProfilePreview(DB, userId, revisionId);
    if (!preview)
      throw new InputError("Create and review a private profile design before continuing.");
    if (!preview.alreadyPublished) {
      await createD1Repositories(DB).surfaces.publishRevision({
        actorId: userId as never,
        surfaceId: preview.surfaceId,
        revisionId: preview.revisionId,
        expectedPublishedRevisionNumber: preview.publishedRevisionNumber,
        governanceVersion: preview.governanceVersion,
        at: new Date(),
      });
    }
    await publishProfile(DB,userId);
    await completeStepInOrder(DB, userId, "page_preview");
    return audit(
      DB,
      userId,
      "profile.preview_approved",
      "profile",
      profile.id,
      { surfaceRevisionId: preview.revisionId },
    );
  }
  if (action === "save_networking") {
    const intent = text(body.intentSummary, 3, 500, "networking intent");
    const similarAdjacent = integer(
      body.similarAdjacent,
      0,
      100,
      "similarity preference",
    );
    const localGlobal = integer(
      body.localGlobal,
      0,
      100,
      "geography preference",
    );
    const serendipity = integer(body.serendipity, 0, 100, "serendipity");
    const maximum = integer(
      body.maximumIntroductionsPerWeek,
      0,
      20,
      "weekly introduction limit",
    );
    const expiresAt = dateAfter(
      body.expiresAt,
      Date.now() + 60_000,
      "Networking Pulse expiry",
    );
    const controls = normalizeControls({
      builderSimilarity: choice(
        body.builderSimilarity,
        ["similar", "adjacent", "balanced"],
        "balanced",
      ),
      geography: choice(
        body.geography,
        ["local", "global", "balanced"],
        "balanced",
      ),
      maximumIntroductionsPerWeek: maximum,
      timezone: timezoneValue(body.timezone),
      quietStart: timeValue(body.quietStart, "22:00"),
      quietEnd: timeValue(body.quietEnd, "08:00"),
      snoozedUntil: nullableDate(body.snoozedUntil),
      exclusions: stringList(body.exclusions, 25).map((item) => identifier(item,"excluded builder identifier")),
      avoidRepeatedClusters: body.avoidRepeatedClusters !== false,
    });
    const now = Date.now();
    const id = `pulse_${crypto.randomUUID()}`;
    const quietStartMinute = minuteOfDay(controls.quietStart);
    const quietEndMinute = minuteOfDay(controls.quietEnd);
    const statements: D1PreparedStatement[] = [
      DB.prepare(
        "INSERT INTO networking_pulses (id,user_id,intent_summary,similar_adjacent,local_global,serendipity,controls_json,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        id,
        userId,
        intent,
        similarAdjacent,
        localGlobal,
        serendipity,
        JSON.stringify(controls),
        now,
        expiresAt,
        now,
      ),
      DB.prepare(
        "INSERT INTO introduction_budgets (user_id,maximum_per_week,used_this_week,week_started_at) VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET maximum_per_week=excluded.maximum_per_week",
      ).bind(userId, maximum, startOfWeek(now)),
      DB.prepare("DELETE FROM quiet_hours WHERE user_id=?").bind(userId),
      DB.prepare("DELETE FROM matching_exclusions WHERE user_id=?").bind(userId),
      DB.prepare("DELETE FROM matching_snoozes WHERE user_id=? AND ends_at>?").bind(userId,now),
    ];
    if (quietStartMinute !== quietEndMinute) {
      for (let weekday=0;weekday<7;weekday+=1) {
        statements.push(DB.prepare("INSERT INTO quiet_hours (id,user_id,timezone,weekday,start_minute,end_minute) VALUES (?,?,?,?,?,?)").bind(`quiet_${stableIdSuffix(userId,String(weekday),controls.quietStart,controls.quietEnd)}`,userId,controls.timezone,weekday,quietStartMinute,quietEndMinute));
      }
    }
    for (const excludedUserId of controls.exclusions) {
      statements.push(DB.prepare("INSERT INTO matching_exclusions (id,user_id,kind,normalized_value,created_at) VALUES (?,?,'user',?,?)").bind(`exclude_${stableIdSuffix(userId,excludedUserId)}`,userId,excludedUserId,now));
    }
    if (controls.snoozedUntil && Date.parse(controls.snoozedUntil)>now) {
      statements.push(DB.prepare("INSERT INTO matching_snoozes (id,user_id,reason,starts_at,ends_at,created_at) VALUES (?,?,'networking_settings',?,?,?)").bind(`snooze_${crypto.randomUUID()}`,userId,now,Date.parse(controls.snoozedUntil),now));
    }
    await DB.batch(statements);
    await completeStepIfCurrent(DB, userId, "networking_pulse");
    return audit(DB, userId, "networking_pulse.saved", "networking_pulse", id, {
      expiresAt,
    });
  }
  if (action === "save_acceptance") {
    const mode = choice(
      body.mode,
      ["manual", "full_autopilot"],
      "manual",
    ) as AcceptanceMode;
    const result = await DB.prepare(
      "UPDATE profiles SET acceptance_mode=?,updated_at=? WHERE user_id=?",
    )
      .bind(mode, Date.now(), userId)
      .run();
    if (!result.meta.changes)
      throw new InputError("Complete your profile first.");
    await completeStepInOrder(DB, userId, "acceptance_mode");
    return audit(DB, userId, "acceptance_mode.saved", "user", userId, { mode });
  }
  if (action === "save_automation") {
    const cadence = readCadence(body.cadence);
    const enabled = Boolean(body.enabled) && cadence !== "manual";
    const sourceLivenessReviewed = body.sourceLivenessReviewed === true;
    if (!sourceLivenessReviewed)
      throw new InputError("Review source liveness before saving automation.");
    const now = Date.now();
    const existingRow = await DB.prepare("SELECT state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind='buildmates'").bind(userId).first<{stateJson:string}>();
    const existingState = safeObject(existingRow?.stateJson??"{}");
    const connected = await hasActiveBuildmatesIdentityLink(DB,userId);
    const requestCapabilityRecheck = body.requestCapabilityRecheck === true;
    const existingCapability = readCapability(existingState.capability);
    const capability = !connected ? "automation_unavailable" : requestCapabilityRecheck ? "approval_required" : existingCapability;
    const state = {
      cadence,
      enabled,
      state: enabled ? "requested" : "disabled",
      hostTaskConfirmed: false,
      backgroundExecutionVerified: false,
      sourceLivenessReviewed,
      capability,
      checkedAt: capability === "available" && typeof existingState.checkedAt === "string" ? existingState.checkedAt : null,
      recheckRequestedAt: requestCapabilityRecheck ? new Date(now).toISOString() : null,
    };
    await DB.prepare(
      "INSERT INTO automation_checkpoints (id,user_id,kind,cursor,state_json,updated_at) VALUES (?,?, 'buildmates',NULL,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at",
    )
      .bind(
        `automation_${stableIdSuffix(userId)}`,
        userId,
        JSON.stringify(state),
        now,
      )
      .run();
    await completeStepIfCurrent(DB, userId, "automation");
    return audit(DB, userId, "automation.preferences_saved", "user", userId, {
      cadence,
      enabled,
      capability,
    });
  }
  if (action === "complete_outcome") {
    const id = `watch_${stableIdSuffix(userId, "relevant_builder", "network")}`;
    await DB.prepare(
      "INSERT INTO watches (id,user_id,kind,target_id,created_at,revoked_at) VALUES (?,?,'relevant_builder','network',?,NULL) ON CONFLICT(user_id,kind,target_id) DO UPDATE SET revoked_at=NULL",
    )
      .bind(id, userId, Date.now())
      .run();
    return audit(DB, userId, "watch.created", "relevant_builder", "network", {});
  }
  throw new InputError("Unknown onboarding action.");
}

export async function updateWorkSignal(
  DB: DB,
  userId: string,
  body: Record<string, unknown>,
  at = Date.now(),
): Promise<void> {
  const id = identifier(body.id, "signal identifier");
  const action = String(body.action ?? "update");
  const now = at;
  if (action === "reject" || action === "delete") {
    const results = await DB.batch([
      DB.prepare("UPDATE work_signals SET revoked_at=?,updated_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(now,now,id,userId),
      ...matchingInvalidationStatements(DB,userId,now),
    ]);
    if (!results[0].meta.changes) throw new NotFoundError();
    return audit(DB, userId, `work_signal.${action}`, "work_signal", id, {}, now);
  }
  const summary = text(body.summary, 1, 12000, "signal summary");
  const audience = workSignalAudienceValue(body.audience);
  const expiresAt = dateAfter(body.expiresAt, now, "Signal expiry");
  const results = await DB.batch([
    DB.prepare("UPDATE work_signals SET free_text_summary=?,audience=?,allow_matching=?,expires_at=?,updated_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(
      summary,
      audience,
      Boolean(body.allowMatching) ? 1 : 0,
      expiresAt,
      now,
      id,
      userId,
    ),
    ...matchingInvalidationStatements(DB,userId,now),
  ]);
  if (!results[0].meta.changes) throw new NotFoundError();
  await audit(DB, userId, "work_signal.updated", "work_signal", id, {
    audience,
    allowMatching: Boolean(body.allowMatching),
  }, now);
}

export async function runPrivacyCommand(
  DB: DB,
  userId: string,
  body: Record<string, unknown>,
  assets?: R2Like,
  at = Date.now(),
): Promise<{ jobId?: string; status?: "deleting" | "complete" }> {
  const command = String(body.command ?? "");
  const now = at;
  if (command === "disconnect_all") {
    const existingAutomation = await DB.prepare("SELECT state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind='buildmates'").bind(userId).first<{stateJson:string}>();
    const disconnectedAutomation = {...safeObject(existingAutomation?.stateJson??"{}"),capability:"automation_unavailable",checkedAt:null,recheckRequestedAt:null};
    await DB.batch([
      DB.prepare(
        "UPDATE connected_app_preferences SET access_mode='never',revoked_at=?,last_reviewed_at=? WHERE user_id=? AND revoked_at IS NULL",
      ).bind(now, now, userId),
      DB.prepare(
        "UPDATE work_signals SET revoked_at=?,updated_at=? WHERE user_id=? AND revoked_at IS NULL",
      ).bind(now, now, userId),
      DB.prepare(
        "UPDATE identity_links SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
      ).bind(now, userId),
      DB.prepare(
        "UPDATE identity_principals SET revoked_at=? WHERE id IN (SELECT principal_id FROM identity_links WHERE user_id=?) AND revoked_at IS NULL",
      ).bind(now, userId),
      DB.prepare("UPDATE automation_checkpoints SET state_json=?,updated_at=? WHERE user_id=? AND kind='buildmates'").bind(JSON.stringify(disconnectedAutomation),now,userId),
      ...matchingInvalidationStatements(DB,userId,now),
    ]);
    await audit(DB, userId, "sync.disconnected_all", "user", userId, {}, now);
    return {};
  }
  if (command === "pause_matching") {
    const until = dateAfter(body.until, now, "Pause end");
    const id = `snooze_${crypto.randomUUID()}`;
    await DB.batch([
      DB.prepare("DELETE FROM matching_snoozes WHERE user_id=? AND ends_at>?").bind(userId,now),
      DB.prepare("INSERT INTO matching_snoozes (id,user_id,reason,starts_at,ends_at,created_at) VALUES (?,?,'user_pause',?,?,?)").bind(id,userId,now,until,now),
    ]);
    await audit(DB, userId, "matching.paused", "user", userId, { until }, now);
    return {};
  }
  if (command === "resume_matching") {
    await DB.prepare("DELETE FROM matching_snoozes WHERE user_id=? AND ends_at>? ").bind(userId, now).run();
    await audit(DB, userId, "matching.resumed", "user", userId, {}, now);
    return {};
  }
  if (command === "disable_autopilot") {
    await DB.prepare(
      "UPDATE profiles SET acceptance_mode='manual',updated_at=? WHERE user_id=?",
    )
      .bind(now, userId)
      .run();
    await audit(DB, userId, "autopilot.disabled", "user", userId, {}, now);
    return {};
  }
  if (command === "redact_shared_context") {
    const id = `redaction_${crypto.randomUUID()}`;
    await DB.batch([
      DB.prepare("INSERT INTO redaction_jobs (id,user_id,source_kind,source_id,status,created_at,updated_at) VALUES (?,?,'account','shared_connection_context','processing',?,?) ON CONFLICT(user_id,source_kind,source_id) DO UPDATE SET status='processing',updated_at=excluded.updated_at").bind(id,userId,now,now),
      DB.prepare(`UPDATE connection_context_snapshots SET reason='Buildmates connected you through mutual relevance that has since been redacted.',shared_context_json='[]' WHERE connection_id IN (
        SELECT connection.id FROM connections connection JOIN match_pairs pair ON pair.id=connection.match_pair_id
        WHERE pair.user_a_id=? OR pair.user_b_id=?
      )`).bind(userId,userId),
      DB.prepare("UPDATE redaction_jobs SET status='complete',updated_at=? WHERE user_id=? AND source_kind='account' AND source_id='shared_connection_context'").bind(now,userId),
    ]);
    await audit(DB,userId,"shared_context.redacted","user",userId,{},now);
    return { jobId: id };
  }
  if (command === "request_export") {
    const id = `export_${crypto.randomUUID()}`;
    await DB.prepare(
      "INSERT INTO export_jobs (id,user_id,status,created_at,updated_at) VALUES (?,?,'queued',?,?)",
    )
      .bind(id, userId, now, now)
      .run();
    await audit(DB, userId, "export.requested", "export_job", id, {}, now);
    return { jobId: id };
  }
  if (command === "request_deletion") {
    if (body.confirmation !== "DELETE BUILDMATES")
      throw new InputError("Type DELETE BUILDMATES to confirm.");
    try {
      return await beginAccountDeletion(DB, userId, assets);
    } catch (error) {
      if (error instanceof Error && error.message === "account_assets_unavailable") throw new ConflictError("Account assets could not be reached. Try deletion again.");
      if (error instanceof Error && error.message === "account_deletion_conflict") throw new ConflictError("Account deletion could not be started.");
      throw error;
    }
  }
  if (command === "delete_project") {
    const slug = text(body.slug,1,72,"project slug");
    await changeProjectLifecycle(DB,userId,slug,"delete");
    await audit(DB,userId,"project.deleted","project",slug,{},now);
    return {};
  }
  throw new InputError("Unknown privacy command.");
}

export async function recordTrustedAutomationCapability(
  DB: DB,
  userId: string,
  capability: "available" | "approval_required" | "automation_unavailable",
  checkedAt = Date.now(),
): Promise<void> {
  if (!Number.isFinite(checkedAt) || Math.abs(Date.now() - checkedAt) > 5 * 60_000) throw new InputError("Automation capability proof timestamp is invalid.");
  if (capability === "available") throw new ConflictError("A foreground connection cannot prove unattended automation.");
  const row=await DB.prepare("SELECT state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind='buildmates'").bind(userId).first<{stateJson:string}>();
  const state={...safeObject(row?.stateJson??"{}"),capability,checkedAt:null,proofSource:null,recheckRequestedAt:null};
  await DB.prepare("INSERT INTO automation_checkpoints (id,user_id,kind,state_json,updated_at) VALUES (?,?,'buildmates',?,?) ON CONFLICT(user_id,kind) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at").bind(`automation_${stableIdSuffix(userId)}`,userId,JSON.stringify(state),checkedAt).run();
}

export async function completeStepIfCurrent(
  DB: DB,
  userId: string,
  step: SetupStep,
): Promise<void> {
  const row = await DB.prepare(
    "SELECT completed_steps_json AS completedStepsJson FROM setup_states WHERE user_id=?",
  )
    .bind(userId)
    .first<{ completedStepsJson: string }>();
  const state = getSetupState({
    completedSteps: safeStringArray(
      row?.completedStepsJson ?? "[]",
    ) as SetupStep[],
  });
  if (state.completedSteps.includes(step)) return;
  if (state.nextStep === step) await completeStepInOrder(DB, userId, step);
}

async function completeStepInOrder(
  DB: DB,
  userId: string,
  step: SetupStep,
): Promise<void> {
  if (!SETUP_STEPS.includes(step)) throw new InputError("Invalid setup step.");
  const now = Date.now();
  const row = await DB.prepare(
    "SELECT completed_steps_json AS completedStepsJson FROM setup_states WHERE user_id=?",
  )
    .bind(userId)
    .first<{ completedStepsJson: string }>();
  const current = getSetupState({
    completedSteps: safeStringArray(
      row?.completedStepsJson ?? "[]",
    ) as SetupStep[],
  });
  if (current.completedSteps.includes(step)) return;
  if (current.nextStep !== step)
    throw new ConflictError(`Complete ${labelStep(current.nextStep)} first.`);
  const next = [...current.completedSteps, step];
  if (row) {
    const result = await DB.prepare(
      "UPDATE setup_states SET completed_steps_json=?,updated_at=? WHERE user_id=? AND completed_steps_json=?",
    )
      .bind(JSON.stringify(next), now, userId, row.completedStepsJson)
      .run();
    if (!result.meta.changes)
      throw new ConflictError(
        "Setup changed in another session. Refresh and continue.",
      );
  } else {
    await DB.prepare(
      "INSERT INTO setup_states (user_id,completed_steps_json,updated_at) VALUES (?,?,?)",
    )
      .bind(userId, JSON.stringify(next), now)
      .run();
  }
}

async function ensureUser(DB: DB, userId: string): Promise<void> {
  const now = Date.now();
  await DB.prepare(
    "INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?) ON CONFLICT(id) DO NOTHING",
  )
    .bind(userId, now, now)
    .run();
}

async function hasActiveBuildmatesIdentityLink(DB: DB,userId:string):Promise<boolean>{
  const row=await DB.prepare("SELECT 1 AS connected FROM identity_links WHERE user_id=? AND provider_channel='mcp' AND provider_issuer='buildmates_mcp' AND workspace_scope='global' AND revoked_at IS NULL LIMIT 1").bind(userId).first();
  return Boolean(row);
}

async function synchronizeIdentityLinkStep(DB:DB,userId:string,now:number):Promise<boolean>{
  const [connected,row]=await Promise.all([
    hasActiveBuildmatesIdentityLink(DB,userId),
    DB.prepare("SELECT completed_steps_json AS completedStepsJson FROM setup_states WHERE user_id=?").bind(userId).first<{completedStepsJson:string}>(),
  ]);
  const stored=safeStringArray(row?.completedStepsJson??"[]").filter((step):step is SetupStep=>SETUP_STEPS.includes(step as SetupStep));
  const next=SETUP_STEPS.filter((step)=>step==="identity_link"?connected:stored.includes(step));
  if(JSON.stringify(stored)!==JSON.stringify(next)){
    await DB.prepare("INSERT INTO setup_states (user_id,completed_steps_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET completed_steps_json=excluded.completed_steps_json,updated_at=excluded.updated_at").bind(userId,JSON.stringify(next),now).run();
  }
  return connected;
}

function matchingInvalidationStatements(DB:DB,userId:string,now:number):D1PreparedStatement[]{
  return [
    DB.prepare("UPDATE builder_match_index SET version=version+1,topics_json='[]',tools_json='[]',domains_json='[]',stages_json='[]',intents_json='[]',updated_at=? WHERE user_id=?").bind(now,userId),
    DB.prepare("DELETE FROM pair_scores WHERE user_a_id=? OR user_b_id=?").bind(userId,userId),
    DB.prepare("DELETE FROM candidate_batches WHERE user_id=? OR EXISTS (SELECT 1 FROM json_each(candidate_ids_json) WHERE value=?)").bind(userId,userId),
    DB.prepare("UPDATE match_proposals SET state='invalidated',terminal_at=? WHERE state='pending' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?)").bind(now,userId,userId),
    DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE read_at IS NULL AND kind IN ('match_candidate','match_proposal','match_ready','candidate_shortlist') AND (user_id=? OR (json_valid(payload_json) AND (json_extract(payload_json,'$.candidateUserId')=? OR json_extract(payload_json,'$.userId')=?)))").bind(now,userId,userId,userId),
  ];
}

async function audit(
  DB: DB,
  userId: string,
  action: string,
  objectKind: string,
  objectId: string,
  metadata: Record<string, unknown>,
  at = Date.now(),
): Promise<void> {
  await DB.prepare(
    "INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      `audit_${crypto.randomUUID()}`,
      userId,
      action,
      objectKind,
      objectId,
      JSON.stringify(metadata),
      at,
    )
    .run();
}

function safeObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
function safeStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
function text(value: unknown, min: number, max: number, label: string): string {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new InputError(`${label} must be ${min}-${max} characters.`);
  return result;
}
function identifier(value: unknown, label: string): string {
  const result = text(value, 2, 128, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(result))
    throw new InputError(`Invalid ${label}.`);
  return result;
}
function workSignalAudienceValue(value: unknown): Audience {
  const result = String(value);
  if (!["suggested_connections", "mutual_connections", "private"].includes(result))
    throw new InputError("Work Signals cannot be public.");
  return result as Audience;
}
function integer(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max)
    throw new InputError(`Invalid ${label}.`);
  return result;
}
function stringList(value: unknown, max: number): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((item) => typeof item !== "string")
  )
    throw new InputError("Invalid list.");
  return value.map((item) => item.trim()).filter(Boolean);
}
function urlList(value: unknown): string[] {
  return stringList(value ?? [], 12).map((item) => {
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      throw new InputError("Enter complete https:// links.");
    }
    if (url.protocol !== "https:")
      throw new InputError("Portfolio links must use HTTPS.");
    return url.toString();
  });
}
function dateAfter(value: unknown, threshold: number, label: string): number {
  const result = Date.parse(String(value ?? ""));
  if (!Number.isFinite(result) || result <= threshold)
    throw new InputError(`${label} must be in the future.`);
  return result;
}
function nullableDate(value: unknown): string | null {
  if (!value) return null;
  const result = Date.parse(String(value));
  if (!Number.isFinite(result)) throw new InputError("Invalid snooze date.");
  return new Date(result).toISOString();
}
function timeValue(value: unknown, fallback: string): string {
  const result = String(value || fallback);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result))
    throw new InputError("Invalid quiet-hours time.");
  return result;
}
function timezoneValue(value: unknown): string {
  const result=text(value||"UTC",1,80,"timezone");
  try{new Intl.DateTimeFormat("en-US",{timeZone:result}).format(new Date(0));}catch{throw new InputError("Choose a valid IANA timezone.");}
  return result;
}
function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  const result = String(value ?? fallback) as T;
  return values.includes(result) ? result : fallback;
}
function readCadence(value: unknown): AutomationCadence {
  return choice(
    value,
    ["automatic", "daily", "twice_weekly", "weekly", "manual"] as const,
    "manual",
  );
}
function readCapability(
  value: unknown,
): "available" | "approval_required" | "automation_unavailable" {
  if (value === "available") return "approval_required";
  return choice(
    value,
    ["available", "approval_required", "automation_unavailable"] as const,
    "automation_unavailable",
  );
}
function normalizeControls(value: Record<string, unknown>): NetworkingControls {
  return {
    builderSimilarity: choice(
      value.builderSimilarity,
      ["similar", "adjacent", "balanced"] as const,
      "balanced",
    ),
    geography: choice(
      value.geography,
      ["local", "global", "balanced"] as const,
      "balanced",
    ),
    maximumIntroductionsPerWeek: Number.isInteger(
      value.maximumIntroductionsPerWeek,
    )
      ? Number(value.maximumIntroductionsPerWeek)
      : 3,
    timezone: typeof value.timezone === "string" ? value.timezone : "UTC",
    quietStart: timeValue(value.quietStart, "22:00"),
    quietEnd: timeValue(value.quietEnd, "08:00"),
    snoozedUntil:
      typeof value.snoozedUntil === "string" ? value.snoozedUntil : null,
    exclusions: Array.isArray(value.exclusions)
      ? value.exclusions
          .filter((item): item is string => typeof item === "string")
          .slice(0, 25)
      : [],
    avoidRepeatedClusters: value.avoidRepeatedClusters !== false,
  };
}
function canonicalControls(value:Record<string,unknown>,quietRows:Array<Record<string,unknown>>,snoozedUntil:number|null,exclusionRows:Array<Record<string,unknown>>):NetworkingControls{
  const base=normalizeControls(value);
  const quiet=quietRows[0];
  return {
    ...base,
    timezone:quiet?String(quiet.timezone):base.timezone,
    quietStart:quiet?timeFromMinute(Number(quiet.startMinute)):"00:00",
    quietEnd:quiet?timeFromMinute(Number(quiet.endMinute)):"00:00",
    snoozedUntil:snoozedUntil==null?null:iso(snoozedUntil),
    exclusions:exclusionRows.filter((row)=>row.kind==="user").map((row)=>String(row.normalizedValue)),
  };
}
function minuteOfDay(value:string):number{const [hour,minute]=value.split(":").map(Number);return hour*60+minute}
function timeFromMinute(value:number):string{return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`}
function startOfWeek(now: number): number {
  const date = new Date(now);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
function iso(value: number): string {
  return new Date(value).toISOString();
}
function labelStep(step: SetupStep | null): string {
  return step?.replaceAll("_", " ") ?? "setup";
}
function stableIdSuffix(...parts: string[]): string {
  let hash = 2166136261;
  for (const char of parts.join("\0")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export class InputError extends Error {
  readonly status = 400;
}
export class ConflictError extends Error {
  readonly status = 409;
}
export class NotFoundError extends Error {
  readonly status = 404;
}
export function apiError(error: unknown): Response {
  const malformedJson = error instanceof SyntaxError;
  const status =
    error instanceof InputError ||
    error instanceof ConflictError ||
    error instanceof NotFoundError
      ? error.status
      : malformedJson
        ? 400
        : 500;
  const message =
    malformedJson
      ? "Invalid JSON request."
      : status === 500
        ? "Something went wrong. Try again."
        : error instanceof Error
          ? error.message
          : "Invalid request.";
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}
