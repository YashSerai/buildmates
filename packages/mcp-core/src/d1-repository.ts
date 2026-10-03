import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import { asUserId } from "@buildmates/domain";
import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, designPolicy, profileMediaBinding, surfaceMediaIsAuthorized, type SurfaceSpec } from "@buildmates/surfaces";
import { canonicalFollowWatchId, normalizeMcpPageLimit, type IdempotentMutation, type McpPageOptions, type McpProductRepository, type McpRecord, type McpRecordPage, type McpRecordWrite } from "./repository";

type BoundStatement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta?: { changes?: number } }> };
type Statement = BoundStatement & { bind(...values: unknown[]): BoundStatement };
type Database = { prepare(sql: string): Statement; batch(statements: BoundStatement[]): Promise<unknown[]> };
type Row = Record<string, unknown>;

// Keep profile writes atomic with account lifecycle changes. The users row is
// the serialization point: inactive statuses deliberately violate its NOT
// NULL timestamp constraint, which makes D1 roll back the whole batch.
function isInactiveActorGuardError(error: unknown) {
  return error instanceof Error && /users\.updated_at/i.test(error.message);
}

const OWNED_ID_KINDS = new Set(["work_signal", "networking_pulse", "profile_model", "invite", "candidate_evaluation", "manual_match_response", "connection_private_note", "connection_reminder", "intro_feedback", "surface_revision", "surface_asset_attachment", "calendar_receipt"]);

export function createD1McpProductRepository(database: unknown): McpProductRepository {
  const DB = database as Database;
  const domain = createD1Repositories(DB as unknown as RepositoryD1);

  const readCanonical = async <T>(kind: string, requestedId: string, actor: string): Promise<McpRecord<T> | null> => {
    const id = OWNED_ID_KINDS.has(kind) ? await resolveOwnedId(DB, domain, kind, requestedId, actor, false) : requestedId;
    const at = new Date().toISOString();
    if (kind === "setup") {
      const row = await first(DB, "SELECT completed_steps_json AS completedStepsJson,updated_at AS updatedAt FROM setup_states WHERE user_id=?", actor);
      return row ? record(kind, actor, actor, [], { completedSteps: JSON.parse(String(row.completedStepsJson)), updatedAt: new Date(Number(row.updatedAt)).toISOString() } as T, 1, at) : null;
    }
    if (kind === "source_policy") {
      const row = await first(DB, "SELECT app_id AS sourceId,display_name AS displayName,category,access_mode AS policy,last_reviewed_at AS reviewedAt FROM connected_app_preferences WHERE user_id=? AND app_id=? AND revoked_at IS NULL", actor, requestedId);
      return row ? record(kind, requestedId, actor, [], row as T, Number(row.reviewedAt ?? 1), at) : null;
    }
    if (kind === "follow_watch") return followWatchRecord<T>(DB, requestedId, actor, at);
    if (kind === "work_signal") return ownedRow<T>(DB, kind, id, actor, "work_signals", "user_id", workSignalValue);
    if (kind === "networking_pulse") return ownedRow<T>(DB, kind, id, actor, "networking_pulses", "user_id", pulseValue);
    if (kind === "profile_model") {
      const row = await first(DB, "SELECT p.*,h.handle,(SELECT s.id FROM surfaces s WHERE s.kind='profile' AND s.subject_id=p.id LIMIT 1) AS surface_id,(SELECT json_group_array(topic_id) FROM profile_topic_contributions c WHERE c.user_id=p.user_id) AS canonical_topic_ids_json FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.id=? AND (p.user_id=? OR p.audience IN ('public','signed_in'))", id, actor);
      return row ? record(kind, String(row.id), String(row.user_id), [], profileValue(row) as T, Number(row.updated_at ?? 1), at) : null;
    }
    if (kind === "invite") return ownedRow<T>(DB, kind, id, actor, "invite_links", "creator_user_id", inviteValue);
    if (kind === "candidate_batch") return ownedRow<T>(DB, kind, requestedId, actor, "candidate_batches", "user_id", candidateBatchValue);
    if (kind === "match_proposal") {
      const row = await first(DB, "SELECT mp.* FROM match_proposals mp JOIN match_pairs pair ON pair.id=mp.match_pair_id WHERE mp.id=? AND ? IN (pair.user_a_id,pair.user_b_id)", requestedId, actor);
      return row ? record(kind, requestedId, actor, [], rowValue(row) as T, 1, at) : null;
    }
    if (kind === "candidate_evaluation") return ownedRow<T>(DB, kind, id, actor, "codex_evaluations", "user_id", rowValue);
    if (kind === "manual_match_response") return ownedRow<T>(DB, kind, id, actor, "human_responses", "user_id", rowValue);
    if (kind === "connection") {
      const row = await first(DB, "SELECT c.*,pair.user_a_id,pair.user_b_id,side.muted,side.renewed_relevance_enabled,side.renewed_relevance_acknowledged_at FROM connections c JOIN match_pairs pair ON pair.id=c.match_pair_id LEFT JOIN connection_sides side ON side.connection_id=c.id AND side.user_id=? WHERE c.id=? AND ? IN (pair.user_a_id,pair.user_b_id)", actor, requestedId, actor);
      return row ? record(kind, requestedId, String(row.user_a_id), [String(row.user_b_id)], { id: row.id, state: row.state, matchId: row.match_id, sides: { [actor]: { muted: Boolean(row.muted), renewedRelevanceEnabled: Boolean(row.renewed_relevance_enabled), renewedRelevanceAcknowledgedAt: row.renewed_relevance_acknowledged_at == null ? null : new Date(Number(row.renewed_relevance_acknowledged_at)).toISOString() } } } as T, Number(row.updated_at ?? 1), at) : null;
    }
    if (kind === "connection_private_note") return ownedRow<T>(DB, kind, id, actor, "connection_private_notes", "owner_user_id", connectionNoteValue);
    if (kind === "connection_reminder") return ownedRow<T>(DB, kind, id, actor, "connection_reminders", "user_id", connectionReminderValue);
    if (kind === "room") {
      const row = await first(DB, `SELECT r.*,
        (SELECT COUNT(*) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS message_count,
        (SELECT COUNT(DISTINCT m.sender_user_id) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS active_participant_count,
        (SELECT MAX(m.created_at) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS last_activity_at,
        EXISTS(SELECT 1 FROM introduction_feedback f WHERE f.connection_id=r.connection_id AND f.user_id=?) AS feedback_submitted,
        EXISTS(SELECT 1 FROM introduction_feedback f WHERE f.connection_id=r.connection_id AND f.user_id=? AND f.useful=1) AS positive_feedback,
        CASE
          WHEN EXISTS(SELECT 1 FROM room_upgrade_proposals p WHERE p.room_id=r.id AND p.status='proposed') THEN 'pending'
          WHEN EXISTS(SELECT 1 FROM room_upgrade_proposals p WHERE p.room_id=r.id AND p.status='activated') THEN 'active'
          ELSE 'none'
        END AS upgrade_state
        FROM rooms r JOIN room_memberships rm ON rm.room_id=r.id
        WHERE r.id=? AND rm.user_id=? AND rm.left_at IS NULL`, actor, actor, requestedId, actor);
      if (!row) return null;
      const members = await all(DB, "SELECT rm.user_id,p.display_name,p.timezone FROM room_memberships rm LEFT JOIN profiles p ON p.user_id=rm.user_id WHERE rm.room_id=? AND rm.left_at IS NULL ORDER BY rm.joined_at,rm.user_id", requestedId);
      const other = members.find((member) => String(member.user_id) !== actor);
      const windows = other ? await all(DB, `SELECT MAX(mine.starts_at,theirs.starts_at) AS starts_at,MIN(mine.ends_at,theirs.ends_at) AS ends_at,mine.timezone AS mine_timezone,theirs.timezone AS theirs_timezone
        FROM availability_windows mine JOIN availability_windows theirs ON theirs.room_id=mine.room_id AND theirs.user_id=? AND theirs.status='approved'
        WHERE mine.room_id=? AND mine.user_id=? AND mine.status='approved' AND MAX(mine.starts_at,theirs.starts_at)<MIN(mine.ends_at,theirs.ends_at)
        ORDER BY starts_at LIMIT 20`, String(other.user_id), requestedId, actor) : [];
      const theme = row.theme_topic_id ? await first(DB, "SELECT label FROM topics WHERE id=?", row.theme_topic_id) : null;
      const room = {
        ...roomValue(row),
        participants: members.map((member) => ({ userId: String(member.user_id), label: String(member.display_name ?? "Buildmate") })),
        timezones: members.filter((member) => member.timezone).map((member) => ({ userId: String(member.user_id), timezone: String(member.timezone) })),
        candidateWindows: windows.map((window) => ({ startsAt: new Date(Number(window.starts_at)).toISOString(), endsAt: new Date(Number(window.ends_at)).toISOString(), viewerTimezone: String(window.mine_timezone), otherTimezone: String(window.theirs_timezone) })),
        agenda: theme?.label ? `Continue the Buildmates introduction around ${String(theme.label)}` : "Continue the Buildmates introduction",
      };
      return record(kind, requestedId, actor, members.map((member) => String(member.user_id)).filter((user) => user !== actor), room as T, Number(row.updated_at ?? 1), at);
    }
    if (kind === "circle") {
      const row = await first(DB, "SELECT c.*,(SELECT s.id FROM surfaces s WHERE s.kind='circle' AND s.subject_id=c.id LIMIT 1) AS surface_id FROM circles c JOIN circle_memberships cm ON cm.circle_id=c.id WHERE c.id=? AND cm.user_id=? AND cm.status='active'", requestedId, actor);
      if (!row) return null;
      const members = await all(DB, "SELECT user_id FROM circle_memberships WHERE circle_id=? AND status='active'", requestedId);
      return record(kind, requestedId, actor, members.map((member) => String(member.user_id)).filter((user) => user !== actor), circleValue(row) as T, Number(row.updated_at ?? 1), at);
    }
    if (kind === "intro_feedback") return ownedRow<T>(DB, kind, id, actor, "introduction_feedback", "user_id", rowValue);
    if (kind === "surface") return surfaceRecord<T>(DB, requestedId, actor);
    if (kind === "surface_revision") {
      const revision = await domain.surfaces.findRevisionForViewer(id, asUserId(actor));
      if (!revision) return null;
      const surface = await surfaceRecord<Row>(DB, revision.surfaceId, actor);
      if (!surface) return null;
      const metadata = await first(DB, "SELECT r.status,base.id AS baseRevisionId FROM surface_revisions r LEFT JOIN surface_revisions base ON base.surface_id=r.surface_id AND base.revision_number=r.base_revision_number WHERE r.id=?", revision.id);
      return record(kind, revision.id, revision.authorUserId, revision.visibility === "personal_view" ? [] : surface.memberUserIds, { surfaceId: revision.surfaceId, revisionNumber: revision.revisionNumber, baseRevisionNumber: revision.baseRevisionNumber, baseRevisionId: metadata?.baseRevisionId == null ? null : String(metadata.baseRevisionId), visibility: revision.visibility ?? "private_preview", spec: JSON.parse(revision.specJson), status: String(metadata?.status ?? "stored") } as T, revision.revisionNumber, revision.createdAt.toISOString());
    }
    if (kind === "surface_approval") return ownedRow<T>(DB, kind, requestedId, actor, "surface_approvals", "user_id", rowValue, "revision_id || ':' || user_id");
    if (kind === "calendar_receipt") {
      const row = await first(DB, "SELECT cer.* FROM calendar_event_receipts cer JOIN room_memberships rm ON rm.room_id=cer.room_id WHERE cer.id=? AND rm.user_id=? AND rm.left_at IS NULL", id, actor);
      return row ? record(kind, id, String(row.attached_by_user_id), [], calendarValue(row) as T, 1, at) : null;
    }
    if (kind === "automation_checkpoint") {
      const checkpointKind = requestedId.includes(":") ? requestedId.slice(requestedId.indexOf(":") + 1) : requestedId;
      const row = await first(DB, "SELECT * FROM automation_checkpoints WHERE user_id=? AND kind=?", actor, checkpointKind);
      return row ? record(kind, `${actor}:${checkpointKind}`, actor, [], automationValue(row) as T, Number(row.updated_at ?? 1), at) : null;
    }
    return null;
  };

  const listSurfaceRevisionPage = async <T>(actor: string, options: McpPageOptions): Promise<McpRecordPage<T>> => {
    const surfaceId = options.filter?.surfaceId;
    const limit = normalizeMcpPageLimit(options.limit);
    const take = limit + 1;
    const cursor = options.cursor ?? "";
    const authorized: McpRecord<T>[] = [];

    // Parent surface authorization is checked before this filtered history
    // read. Keep personal revisions author-bound in SQL, fetch one bounded
    // candidate window, then run canonical policy and publication checks on
    // that window before exposing records or a cursor.
    const rows = surfaceId
      ? await all(DB, "SELECT r.id,r.surface_id,r.base_revision_number,r.status,base.id AS base_revision_id FROM surface_revisions r LEFT JOIN surface_revisions base ON base.surface_id=r.surface_id AND base.revision_number=r.base_revision_number WHERE r.surface_id=? AND r.id>? AND (r.visibility<>'personal_view' OR r.author_user_id=?) ORDER BY r.id LIMIT ?", surfaceId, cursor, actor, take)
      : await all(DB, "SELECT r.id,r.surface_id,r.base_revision_number,r.status,base.id AS base_revision_id FROM surface_revisions r JOIN surfaces s ON s.id=r.surface_id LEFT JOIN surface_revisions base ON base.surface_id=r.surface_id AND base.revision_number=r.base_revision_number WHERE r.id>? AND ((r.visibility='personal_view' AND r.author_user_id=?) OR (r.visibility<>'personal_view' AND (s.owner_user_id=? OR (s.kind='room' AND EXISTS (SELECT 1 FROM room_memberships rm WHERE rm.room_id=s.subject_id AND rm.user_id=? AND rm.left_at IS NULL)) OR (s.kind='circle' AND EXISTS (SELECT 1 FROM circle_memberships cm WHERE cm.circle_id=s.subject_id AND cm.user_id=? AND cm.status='active'))))) ORDER BY r.id LIMIT ?", cursor, actor, actor, actor, actor, take);
    for (const row of rows) {
      const revisionId = String(row.id);
      const revision = await readCanonical<T>("surface_revision", revisionId, actor);
      if (!revision) continue;
      const value = revision.value as Row;
      if (surfaceId && String(value.surfaceId ?? value.surface_id) !== surfaceId) continue;
      authorized.push({
        ...revision,
        value: {
          ...value,
          status: String(row.status ?? value.status ?? "stored"),
          baseRevisionId: row.base_revision_id == null ? null : String(row.base_revision_id),
        } as T,
      });
      if (authorized.length > limit) break;
    }

    const hasMore = authorized.length > limit;
    const records = authorized.slice(0, limit);
    return { records, nextCursor: hasMore ? records.at(-1)?.id ?? null : null };
  };

  return {
    readForMember: readCanonical,
    async listForMember<T>(kind: string, actor: string) {
      if (kind === "surface_revision") return (await listSurfaceRevisionPage<T>(actor, { limit: 50 })).records;
      return (await listCanonicalPage<T>(DB, kind, actor, { limit: 50 })).records;
    },
    async listPageForMember<T>(kind: string, actor: string, options: McpPageOptions) {
      if (kind === "surface_revision") return listSurfaceRevisionPage<T>(actor, options);
      return listCanonicalPage<T>(DB, kind, actor, options);
    },
    async write<T>(input: McpRecordWrite<T>) {
      const actor = input.actorUserId ?? input.ownerUserId;
      const value = input.value as Row;
      const at = Date.parse(input.now);
      const id = OWNED_ID_KINDS.has(input.kind) ? await resolveOwnedId(DB, domain, input.kind, input.id, actor, true) : input.id;
      if (input.kind === "setup") {
        await run(DB, "INSERT INTO setup_states (user_id,completed_steps_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET completed_steps_json=excluded.completed_steps_json,updated_at=excluded.updated_at", actor, JSON.stringify(value.completedSteps ?? []), at);
        return (await readCanonical<T>("setup", actor, actor))!;
      }
      if (input.kind === "source_policy") {
        const policy = String(value.policy);
        const approvalId = value.approveNextWorkSignal === true && policy === "ask_each_time" ? canonicalId("source_approval", actor, `${input.id}:${input.now}`) : null;
        const statements = [DB.prepare("INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL) ON CONFLICT(user_id,app_id) DO UPDATE SET display_name=excluded.display_name,category=excluded.category,access_mode=excluded.access_mode,last_reviewed_at=excluded.last_reviewed_at,revoked_at=NULL").bind(canonicalId("source_policy", actor, input.id), actor, input.id, value.displayName, value.category, policy, at)];
        if (approvalId) statements.push(DB.prepare("INSERT INTO source_use_approvals (id,user_id,source_app_id,purpose,expires_at,created_at) VALUES (?,?,?,'work_signal',?,?)").bind(approvalId, actor, input.id, at + 15 * 60_000, at));
        await DB.batch(statements);
        const saved = (await readCanonical<T>("source_policy", input.id, actor))!;
        saved.value = { ...(saved.value as Row), approvalId } as T;
        return saved;
      }
      if (input.kind === "work_signal") {
        const sourceId = String(value.sourceId);
        if (!["suggested_connections", "mutual_connections", "private"].includes(String(value.audience))) throw new Error("work_signal_public_forbidden");
        const policy = await first(DB, "SELECT access_mode FROM connected_app_preferences WHERE user_id=? AND app_id=? AND revoked_at IS NULL", actor, sourceId);
        if (!policy || ["never", "actions_only"].includes(String(policy.access_mode))) throw new Error("source_policy_denied");
        let approvalId: string | null = null;
        if (policy.access_mode === "ask_each_time") {
          approvalId = String(value.sourceApprovalId ?? "");
          const approval = await first(DB, "SELECT id FROM source_use_approvals WHERE id=? AND user_id=? AND source_app_id=? AND purpose='work_signal' AND consumed_at IS NULL AND expires_at>?", approvalId, actor, sourceId, at);
          if (!approval) throw new Error("source_approval_required");
        }
        const taxonomy = await first(DB, "SELECT id FROM taxonomy_versions WHERE id=? OR CAST(version AS TEXT)=?", value.taxonomyVersion, value.taxonomyVersion);
        if (!taxonomy) throw new Error("taxonomy_identifiers_invalid");
        // submit_work_signal is creation-only. Check the owned key only after
        // policy and one-time approval validation so a consumed approval still
        // fails closed without revealing whether a signal id exists.
        if (await first(DB, "SELECT id FROM work_signals WHERE id=? AND user_id=?", id, actor)) throw new Error("known_work_signal_exists");
        try {
          if (approvalId) {
            const results = await DB.batch([
              DB.prepare("INSERT INTO work_signals (id,user_id,source_app_id,source_approval_id,taxonomy_version_id,free_text_summary,canonical_topic_ids_json,canonical_tool_ids_json,canonical_domain_ids_json,canonical_stage_ids_json,canonical_collaboration_intent_ids_json,audience,allow_matching,approved_at,expires_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM source_use_approvals WHERE id=? AND user_id=? AND source_app_id=? AND purpose='work_signal' AND consumed_at IS NULL AND expires_at>?)").bind(id, actor, sourceId, approvalId, taxonomy.id, value.summary, JSON.stringify(value.canonicalTopicIds ?? []), JSON.stringify(value.canonicalToolIds ?? []), JSON.stringify(value.canonicalDomainIds ?? []), JSON.stringify(value.canonicalStageIds ?? []), JSON.stringify(value.canonicalCollaborationIntentIds ?? []), value.audience, value.allowMatching ? 1 : 0, at, Date.parse(String(value.expiresAt)), at, at, approvalId, actor, sourceId, at),
              DB.prepare("UPDATE source_use_approvals SET consumed_at=? WHERE id=? AND user_id=? AND source_app_id=? AND consumed_at IS NULL").bind(at, approvalId, actor, sourceId),
            ]) as Array<{ meta?: { changes?: number } }>;
            if (results.some((result) => !changed(result))) throw new Error("source_approval_required");
          } else {
            await run(DB, "INSERT INTO work_signals (id,user_id,source_app_id,source_approval_id,taxonomy_version_id,free_text_summary,canonical_topic_ids_json,canonical_tool_ids_json,canonical_domain_ids_json,canonical_stage_ids_json,canonical_collaboration_intent_ids_json,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)", id, actor, sourceId, taxonomy.id, value.summary, JSON.stringify(value.canonicalTopicIds ?? []), JSON.stringify(value.canonicalToolIds ?? []), JSON.stringify(value.canonicalDomainIds ?? []), JSON.stringify(value.canonicalStageIds ?? []), JSON.stringify(value.canonicalCollaborationIntentIds ?? []), value.audience, value.allowMatching ? 1 : 0, at, Date.parse(String(value.expiresAt)), at, at);
          }
        } catch (error) {
          if (error instanceof Error && /UNIQUE/i.test(error.message) && await first(DB, "SELECT id FROM work_signals WHERE id=? AND user_id=?", id, actor)) throw new Error("known_work_signal_exists");
          if (approvalId && error instanceof Error && (error.message.includes("UNIQUE") || error.message === "source_approval_required")) throw new Error("source_approval_required");
          throw error;
        }
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "networking_pulse") {
        const similar = ({ similar: 0, balanced: 50, adjacent: 100 } as Row)[String(value.builderSimilarity)] as number;
        const geography = ({ local: 0, balanced: 50, global: 100 } as Row)[String(value.geography)] as number;
        const statements: BoundStatement[] = [
          DB.prepare("INSERT INTO networking_pulses (id,user_id,intent_summary,similar_adjacent,local_global,serendipity,collaboration_intent_ids_json,controls_json,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?,'[]',?,?,?,?) ON CONFLICT(id) DO UPDATE SET intent_summary=excluded.intent_summary,similar_adjacent=excluded.similar_adjacent,local_global=excluded.local_global,serendipity=excluded.serendipity,controls_json=excluded.controls_json,starts_at=excluded.starts_at,expires_at=excluded.expires_at WHERE networking_pulses.user_id=excluded.user_id").bind(id, actor, value.intentSummary, similar, geography, value.serendipity, JSON.stringify({ maximumIntroductionsPerWeek: value.maximumIntroductionsPerWeek, timezone: value.timezone, quietHours: value.quietHours ?? [], snoozedUntil: value.snoozedUntil ?? null, exclusions: value.exclusions ?? [] }), Date.parse(String(value.startsAt)), Date.parse(String(value.expiresAt)), at),
          DB.prepare("INSERT INTO introduction_budgets (user_id,maximum_per_week,used_this_week,week_started_at) VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET maximum_per_week=excluded.maximum_per_week").bind(actor, value.maximumIntroductionsPerWeek, at),
          DB.prepare("DELETE FROM quiet_hours WHERE user_id=?").bind(actor), DB.prepare("DELETE FROM matching_exclusions WHERE user_id=?").bind(actor), DB.prepare("DELETE FROM matching_snoozes WHERE user_id=?").bind(actor),
        ];
        for (const quiet of (value.quietHours as Row[] ?? [])) statements.push(DB.prepare("INSERT INTO quiet_hours (id,user_id,timezone,weekday,start_minute,end_minute) VALUES (?,?,?,?,?,?)").bind(randomUUID(), actor, value.timezone, quiet.weekday, quiet.startMinute, quiet.endMinute));
        for (const exclusion of (value.exclusions as Row[] ?? [])) statements.push(DB.prepare("INSERT INTO matching_exclusions (id,user_id,kind,normalized_value,created_at) VALUES (?,?,?,?,?)").bind(randomUUID(), actor, exclusion.kind, String(exclusion.value).toLowerCase(), at));
        if (value.snoozedUntil) statements.push(DB.prepare("INSERT INTO matching_snoozes (id,user_id,reason,starts_at,ends_at,created_at) VALUES (?,?,?, ?,?,?)").bind(randomUUID(), actor, "user_requested", at, Date.parse(String(value.snoozedUntil)), at));
        await DB.batch(statements);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "profile_model") {
        const canonicalProfileId = canonicalId("profile", actor, "primary");
        const existingProfile = await first(DB, "SELECT id,published_at,audience,indexable FROM profiles WHERE user_id=?", actor);
        // The web profile editor may have created the profile before the
        // ChatGPT identity was linked. Preserve that row's id so its child
        // fields, statistics, and surface remain attached to the same
        // profile instead of writing a second identity-shaped record.
        const profileId = String(existingProfile?.id ?? canonicalProfileId);
        const publishedAt = existingProfile?.published_at ?? null;
        // Preserve visibility choices made in the web editor. ChatGPT updates
        // content and matching consent here; it must not silently widen an
        // existing signed-in, connection-scoped, or private profile.
        const profileAudience = String(existingProfile?.audience ?? "private");
        const profileIndexable = existingProfile?.indexable == null ? 0 : Number(existingProfile.indexable);
        const matchingReviewedAt = value.allowMatching ? at : null;
        const existingSurface = await first(DB, "SELECT id,owner_user_id FROM surfaces WHERE kind='profile' AND subject_id=?", profileId);
        if (existingSurface && String(existingSurface.owner_user_id) !== actor) throw new Error("forbidden");
        const statements = [
            DB.prepare("UPDATE users SET updated_at=CASE WHEN status='active' THEN updated_at ELSE NULL END WHERE id=?").bind(actor),
            DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,coarse_location,location_map_opt_in,timezone,published_at,matching_reviewed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,portfolio_links_json=excluded.portfolio_links_json,allow_matching=excluded.allow_matching,acceptance_mode=excluded.acceptance_mode,coarse_location=excluded.coarse_location,location_map_opt_in=excluded.location_map_opt_in,timezone=excluded.timezone,matching_reviewed_at=excluded.matching_reviewed_at,updated_at=excluded.updated_at").bind(profileId, actor, value.displayName, value.builderSummary, value.projectOrInterest, JSON.stringify(value.portfolioLinks ?? []), profileAudience, value.allowMatching ? 1 : 0, value.acceptanceMode, profileIndexable, value.coarseLocation || null, value.locationMapOptIn !== false ? 1 : 0, value.timezone || null, publishedAt, matchingReviewedAt, at, at),
          DB.prepare("INSERT INTO handles (user_id,handle,normalized_handle,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle").bind(actor, value.handle, String(value.handle).toLowerCase(), at),
          DB.prepare("DELETE FROM profile_fields WHERE profile_id=(SELECT id FROM profiles WHERE user_id=? )").bind(actor),
          DB.prepare("DELETE FROM profile_topic_contributions WHERE user_id=?").bind(actor),
        ];
        if (!existingSurface) statements.push(DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) SELECT 'surface_profile_' || p.id,?, 'profile',p.id,1,?,? FROM profiles p WHERE p.user_id=? AND NOT EXISTS (SELECT 1 FROM surfaces s WHERE s.kind='profile' AND s.subject_id=p.id) ON CONFLICT(kind,subject_id) DO NOTHING").bind(actor, at, at, actor));
        for (const field of value.fields as Row[] ?? []) statements.push(DB.prepare("INSERT INTO profile_fields (profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at) SELECT (SELECT id FROM profiles WHERE user_id=?),?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM profiles WHERE user_id=?)").bind(actor, field.key, JSON.stringify(field.value), field.audience, field.allowMatching ? 1 : 0, field.sourceStatus, field.provenance, at, actor));
        for (const topicId of value.canonicalTopicIds as string[] ?? []) statements.push(DB.prepare("INSERT INTO profile_topic_contributions (user_id,topic_id,updated_at) VALUES (?,?,?)").bind(actor, topicId, at));
        if (Array.isArray(value.statistics)) {
          statements.push(DB.prepare("DELETE FROM profile_statistics WHERE profile_id=(SELECT id FROM profiles WHERE user_id=? )").bind(actor));
          for (const statistic of value.statistics as Row[]) statements.push(DB.prepare("INSERT INTO profile_statistics (profile_id,stat_key,label,value,provenance,audience,updated_at) SELECT (SELECT id FROM profiles WHERE user_id=?),?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM profiles WHERE user_id=?)").bind(actor, statistic.key, statistic.label, statistic.value, statistic.provenance, statistic.audience, at, actor));
          }
          try {
            await DB.batch(statements);
          } catch (error) {
            if (isInactiveActorGuardError(error)) throw new Error("actor_not_active");
            throw error;
          }
          const storedProfile = await first(DB, "SELECT id FROM profiles WHERE user_id=?", actor);
          if (!storedProfile) throw new Error("profile_write_failed");
          return (await readCanonical<T>(input.kind, String(storedProfile.id), actor))!;
      }
      if (input.kind === "invite") {
        const token = randomBytes(24).toString("base64url");
        await assertInviteTarget(DB,actor,String(value.kind),value.targetId==null?null:String(value.targetId));
        await run(DB, "INSERT INTO invite_links (id,creator_user_id,kind,token_hash,headline,target_id,maximum_uses,use_count,expires_at,created_at) VALUES (?,?,?,?,?,?,?,0,?,?)", id, actor, value.kind, createHash("sha256").update(token).digest("hex"), value.headline, value.targetId??null, value.maximumUses, Date.parse(String(value.expiresAt)), at);
        const saved = (await readCanonical<T>(input.kind, input.id, actor))!;
        saved.value = { ...(saved.value as Row), token } as T;
        return saved;
      }
      if (input.kind === "follow_watch") {
        const enabled = value.enabled === true;
        if(enabled)await assertFollowWatchTarget(DB,actor,String(value.relation),String(value.targetKind),String(value.targetId));
        if (value.relation === "follow") await run(DB, "INSERT INTO follows (follower_user_id,target_kind,target_id,created_at,revoked_at) VALUES (?,?,?,?,?) ON CONFLICT(follower_user_id,target_kind,target_id) DO UPDATE SET revoked_at=excluded.revoked_at", actor, value.targetKind, value.targetId, at, enabled ? null : at);
        else await run(DB, "INSERT INTO watches (id,user_id,kind,target_id,created_at,revoked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,kind,target_id) DO UPDATE SET revoked_at=excluded.revoked_at", canonicalId("watch", actor, `${value.targetKind}:${value.targetId}`), actor, value.targetKind, value.targetId, at, enabled ? null : at);
        const relationId = canonicalFollowWatchId(String(value.relation), String(value.targetKind), String(value.targetId));
        if (!enabled) return record(input.kind, relationId, actor, [], { ...value, enabled: false } as T, at, input.now);
        return (await readCanonical<T>(input.kind, relationId, actor))!;
      }
      if (input.kind === "candidate_evaluation") {
        await assertProposalMember(DB, String(value.proposalId), actor);
        await run(DB, "INSERT INTO codex_evaluations (id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision=excluded.decision,reason_summary=excluded.reason_summary,evidence_ids_json=excluded.evidence_ids_json,index_version=excluded.index_version", id, value.proposalId, actor, value.decision, value.reasonSummary, JSON.stringify(value.evidenceIds ?? []), value.indexVersion, at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "manual_match_response") {
        await assertProposalMember(DB, String(value.proposalId), actor);
        await run(DB, "INSERT INTO human_responses (id,proposal_id,user_id,response,created_at) VALUES (?,?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET response=excluded.response", id, value.proposalId, actor, value.response, at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "connection") {
        const existing = await readCanonical<Row>("connection", input.id, actor);
        if (!existing) throw new Error("object_not_authorized");
        const side = (value.sides as Row)?.[actor] as Row | undefined;
        const acknowledgedAt = side?.renewedRelevanceAcknowledgedAt == null ? null : Date.parse(String(side.renewedRelevanceAcknowledgedAt));
        const statements = [DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,renewed_relevance_acknowledged_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET muted=excluded.muted,renewed_relevance_enabled=excluded.renewed_relevance_enabled,renewed_relevance_acknowledged_at=excluded.renewed_relevance_acknowledged_at,updated_at=excluded.updated_at").bind(input.id, actor, side?.muted ? 1 : 0, side?.renewedRelevanceEnabled === false ? 0 : 1, acknowledgedAt, at, at)];
        if (value.state === "ended") {
          statements.push(DB.prepare("UPDATE connections SET state='ended',ended_by_user_id=?,ended_at=?,updated_at=? WHERE id=? AND state='active'").bind(actor, at, at, input.id));
          statements.push(DB.prepare("UPDATE rooms SET status='ended',updated_at=? WHERE connection_id=? AND status='active'").bind(at, input.id));
        }
        await DB.batch(statements);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "connection_private_note") {
        await assertConnectionMember(DB, String(value.connectionId), actor);
        await run(DB, "INSERT INTO connection_private_notes (id,connection_id,owner_user_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at WHERE connection_private_notes.owner_user_id=excluded.owner_user_id", id, value.connectionId, actor, value.body, at, at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "connection_reminder") {
        await assertConnectionMember(DB, String(value.connectionId), actor);
        await run(DB, "INSERT INTO connection_reminders (id,connection_id,user_id,remind_at,status,created_at) VALUES (?,?,?,?,?,?)", id, value.connectionId, actor, Date.parse(String(value.remindAt)), value.status ?? "scheduled", at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "intro_feedback") {
        await assertConnectionMember(DB, String(value.connectionId), actor);
        await run(DB, "INSERT INTO introduction_feedback (id,connection_id,user_id,useful,reasons_json,similar_match_preference,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET useful=excluded.useful,reasons_json=excluded.reasons_json,similar_match_preference=excluded.similar_match_preference", id, value.connectionId, actor, value.useful ? 1 : 0, JSON.stringify(value.reasons ?? []), value.preferenceSummary ?? "", at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "surface_asset_attachment") {
        const surfaceId = String(value.surfaceId);
        const surface = await surfaceRecord<Row>(DB, surfaceId, actor);
        if (!surface || !["room", "circle"].includes(String(surface.value.kind))) throw new Error("object_not_authorized");
        const assetId = String(value.assetId);
        if (!(await first(DB, "SELECT id FROM surface_assets WHERE id=? AND owner_user_id=? AND deleted_at IS NULL", assetId, actor))) throw new Error("surface_asset_not_authorized");
        const bindingKey = String(value.bindingKey);
        if (bindingKey !== `surface.media.${assetId.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`) throw new Error("surface_asset_not_authorized");
        const altText = String(value.altText).trim().slice(0, 300);
        if (!altText) throw new Error("surface_asset_not_authorized");
        await run(DB, "INSERT INTO surface_asset_attachments (id,surface_id,asset_id,attached_by_user_id,binding_key,alt_text,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL) ON CONFLICT(surface_id,asset_id) DO UPDATE SET alt_text=excluded.alt_text,revoked_at=NULL", id, surfaceId, assetId, actor, bindingKey, altText, at);
        return record(input.kind, id, actor, surface.memberUserIds, { surfaceId, assetId, bindingKey, altText } as T, at, input.now);
      }
      if (input.kind === "surface_revision") {
        const surfaceId = String(value.surfaceId);
        const surface = await surfaceRecord<Row>(DB, surfaceId, actor);
        if (!surface) throw new Error("object_not_authorized");
        if (!surfaceMediaIsAuthorized(
          value.spec as SurfaceSpec,
          (surface.value.authorizedMedia ?? []) as Array<{ key: string; label: string; altKey: string; approvedAssetIds: string[] }>,
          (surface.value.approvedAssets ?? []) as Array<{ id: string; src: string }>,
        )) throw new Error("surface_asset_not_authorized");
        const current = await first(DB, "SELECT COALESCE(MAX(revision_number),0) AS maximum FROM surface_revisions WHERE surface_id=?", surfaceId);
        const requestedBase = value.baseRevisionId ? await first(DB, "SELECT id,revision_number,status,visibility FROM surface_revisions WHERE id=? AND surface_id=?", String(value.baseRevisionId), surfaceId) : null;
        if (value.baseRevisionId && !requestedBase) throw new Error("surface_base_not_found");
        // The domain repository uses base_revision_number as the optimistic
        // concurrency token for the currently published revision. A private
        // draft may be the requested source for a targeted edit, but it must
        // not be written as that token or an unpublished surface rejects the
        // otherwise authorized revision as stale.
        const publishedBase = await first(DB, "SELECT revision_number FROM surface_revisions WHERE id=(SELECT published_revision_id FROM surfaces WHERE id=?)", surfaceId);
        const base = requestedBase?.status === "published" ? requestedBase : publishedBase;
        await domain.surfaces.createRevision({ actorId: asUserId(actor), id, surfaceId, authorUserId: asUserId(actor), revisionNumber: Number(current?.maximum ?? 0) + 1, baseRevisionNumber: base ? Number(base.revision_number) : null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: DESIGN_POLICY_VERSION, visibility: value.visibility as "private_preview" | "personal_view", specJson: JSON.stringify(value.spec as SurfaceSpec), createdAt: new Date(at) });
        if (value.visibility === "personal_view") await domain.surfaces.setPersonalView({ actorId: asUserId(actor), id: canonicalId("personal_view", actor, surfaceId), surfaceId, revisionId: id, at: new Date(at) });
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "surface_approval") {
        const revisionId = String(value.revisionId);
        const revision = await first(DB, "SELECT id,surface_id,visibility FROM surface_revisions WHERE id=?", revisionId);
        if (!revision || !(await surfaceRecord<Row>(DB, String(revision.surface_id), actor))) throw new Error("object_not_authorized");
        if (revision.visibility === "personal_view") throw new Error("personal_view_not_publishable");
        const surfaceId = String(revision.surface_id);
        const surface = await first(DB, "SELECT governance_version,kind,subject_id,published_revision_id FROM surfaces WHERE id=?", surfaceId);
        if (!surface) throw new Error("object_not_authorized");
        await domain.surfaces.decideRevision({ actorId: asUserId(actor), revisionId, governanceVersion: Number(surface.governance_version), decision: value.decision as "approved" | "rejected", at: new Date(at) });
        if (surface.kind === "circle") {
          const circle = await first(DB, "SELECT governance_mode FROM circles WHERE id=?", surface.subject_id);
          if (circle?.governance_mode === "vote") {
            const proposalId = await ensureCircleDesignProposal(DB, domain, String(surface.subject_id), revisionId, actor, Number(surface.governance_version), at);
            await domain.circles.vote({ actorId: asUserId(actor), proposalId, vote: value.decision === "approved" ? "approve" : "reject", at: new Date(at) });
          }
        }
        if (value.decision === "approved" && await surfaceReadyToPublish(DB, surfaceId, revisionId, actor)) {
          const current = surface.published_revision_id ? await first(DB, "SELECT revision_number FROM surface_revisions WHERE id=?", surface.published_revision_id) : null;
          const proposal = surface.kind === "circle" ? await first(DB, "SELECT id FROM circle_proposals WHERE circle_id=? AND kind='design' AND status='approved' AND json_extract(payload_json,'$.revisionId')=?", surface.subject_id, revisionId) : null;
          await domain.surfaces.publishRevision({ actorId: asUserId(actor), surfaceId, revisionId, expectedPublishedRevisionNumber: current ? Number(current.revision_number) : null, governanceVersion: Number(surface.governance_version), proposalId: proposal ? String(proposal.id) : undefined, at: new Date(at) });
          if (surface.kind === "profile") await run(DB, "UPDATE profiles SET audience='public',indexable=1,published_at=COALESCE(published_at,?),updated_at=? WHERE id=?", at, at, surface.subject_id);
        }
        return record(input.kind, `${revisionId}:${actor}`, actor, [], value as T, at, input.now);
      }
      if (input.kind === "surface") {
        const surface = await surfaceRecord<Row>(DB, input.id, actor);
        if (!surface) throw new Error("object_not_authorized");
        const targetRevisionId = String(value.publishedRevisionId);
        const target = await readCanonical<Row>("surface_revision", targetRevisionId, actor);
        if (!target || target.value.surfaceId !== input.id) throw new Error("revision_surface_mismatch");
        if (target.value.visibility === "personal_view") throw new Error("personal_view_not_rollback_target");
        const current = await first(DB, "SELECT revision_number FROM surface_revisions WHERE id=(SELECT published_revision_id FROM surfaces WHERE id=?)", input.id);
        if (input.expectedVersion !== undefined && input.expectedVersion !== (current ? Number(current.revision_number) : null)) throw new Error("version_conflict");
        const maximum = await first(DB, "SELECT COALESCE(MAX(revision_number),0) AS maximum FROM surface_revisions WHERE surface_id=?", input.id);
        const rollbackRevisionId = canonicalId("surface_revision", actor, `rollback:${input.id}:${target.id}:${input.expectedVersion ?? "none"}`);
        await domain.surfaces.createRevision({
          actorId: asUserId(actor),
          id: rollbackRevisionId,
          surfaceId: input.id,
          authorUserId: asUserId(actor),
          revisionNumber: Number(maximum?.maximum ?? 0) + 1,
          baseRevisionNumber: current ? Number(current.revision_number) : null,
          designPolicyId: DESIGN_POLICY_ID,
          designPolicyVersion: DESIGN_POLICY_VERSION,
          visibility: "private_preview",
          specJson: JSON.stringify(target.value.spec as SurfaceSpec),
          createdAt: new Date(at),
        });
        const governanceVersion = Number((surface.value as Row).governanceVersion ?? 1);
        await domain.surfaces.decideRevision({ actorId: asUserId(actor), revisionId: rollbackRevisionId, governanceVersion, decision: "approved", at: new Date(at) });
        const subject = await first(DB, "SELECT kind,subject_id FROM surfaces WHERE id=?", input.id);
        let proposalId: string | undefined;
        if (subject?.kind === "circle") {
          const circle = await first(DB, "SELECT governance_mode FROM circles WHERE id=?", subject.subject_id);
          if (circle?.governance_mode === "vote") {
            proposalId = await ensureCircleDesignProposal(DB, domain, String(subject.subject_id), rollbackRevisionId, actor, governanceVersion, at);
            await domain.circles.vote({ actorId: asUserId(actor), proposalId, vote: "approve", at: new Date(at) });
          }
        }
        if (await surfaceReadyToPublish(DB, input.id, rollbackRevisionId, actor)) {
          const proposal = subject?.kind === "circle" ? await first(DB, "SELECT id FROM circle_proposals WHERE circle_id=? AND kind='design' AND status='approved' AND json_extract(payload_json,'$.revisionId')=?", subject.subject_id, rollbackRevisionId) : null;
          await domain.surfaces.publishRevision({ actorId: asUserId(actor), surfaceId: input.id, revisionId: rollbackRevisionId, expectedPublishedRevisionNumber: current ? Number(current.revision_number) : null, governanceVersion, proposalId: proposal ? String(proposal.id) : proposalId, at: new Date(at) });
        }
        const published = await first(DB, "SELECT 1 AS ok FROM surfaces WHERE id=? AND published_revision_id=?", input.id, rollbackRevisionId);
        let publicationStatus: "published" | "pending_member_approvals" | "pending_admin" | "pending_circle_vote" = "published";
        if (!published) {
          if (subject?.kind === "room") publicationStatus = "pending_member_approvals";
          else if (subject?.kind === "circle") {
            const circle = await first(DB, "SELECT governance_mode FROM circles WHERE id=?", subject.subject_id);
            publicationStatus = circle?.governance_mode === "vote" ? "pending_circle_vote" : "pending_admin";
          }
        }
        const saved = (await readCanonical<T>(input.kind, input.id, actor))!;
        saved.value = { ...(saved.value as Row), rollbackRevisionId, rollbackTargetRevisionId: target.id, publicationStatus, proposalId: proposalId ?? null } as T;
        return saved;
      }
      if (input.kind === "calendar_receipt") {
        await assertRoomMember(DB, String(value.roomId), actor);
        const startsAt=Date.parse(String(value.startsAt)),endsAt=Date.parse(String(value.endsAt));
        const accepted=await first(DB,"SELECT 1 AS accepted FROM meeting_proposals WHERE id=? AND room_id=? AND status='accepted' AND starts_at=? AND ends_at=?",value.meetingProposalId,value.roomId,startsAt,endsAt);
        if(value.trustedProviderConfirmation!==true||!accepted)throw new Error("calendar_receipt_untrusted");
        const conflict=await first(DB,"SELECT room_id,meeting_proposal_id FROM calendar_event_receipts WHERE provider=? AND provider_event_id=?",value.provider,value.providerEventId);
        if(conflict&&(conflict.room_id!==value.roomId||conflict.meeting_proposal_id!==value.meetingProposalId))throw new Error("calendar_receipt_conflict");
        await run(DB, "INSERT INTO calendar_event_receipts (id,room_id,meeting_proposal_id,attached_by_user_id,provider,provider_event_id,starts_at,ends_at,participant_labels_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_event_id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,participant_labels_json=excluded.participant_labels_json,status=excluded.status WHERE calendar_event_receipts.room_id=excluded.room_id AND calendar_event_receipts.meeting_proposal_id=excluded.meeting_proposal_id", id, value.roomId,value.meetingProposalId, actor, value.provider, value.providerEventId, startsAt, endsAt, JSON.stringify(value.participantLabels ?? []), value.status, at);
        return (await readCanonical<T>(input.kind, input.id, actor))!;
      }
      if (input.kind === "automation_checkpoint") {
        const kind = "buildmates";
        const previous = await first(DB, "SELECT state_json FROM automation_checkpoints WHERE user_id=? AND kind='buildmates'", actor);
        const previousState = previous?.state_json ? JSON.parse(String(previous.state_json)) as Row : {};
        const nextState = {
          ...previousState,
          state: value.state,
          lastOutcome: value.lastOutcome,
          configured: value.state !== "disabled" && value.state !== "requested",
          enabled: value.enabled ?? value.state !== "disabled",
          cadence: value.cadence ?? previousState.cadence ?? null,
          sourceLivenessReviewed: value.sourceLivenessReviewed ?? previousState.sourceLivenessReviewed ?? false,
          hostTaskConfirmed: false,
          backgroundExecutionVerified: false,
          reportedState: value.reportedState ?? null,
          requestedNextRunAt: value.requestedNextRunAt ?? null,
        };
        await run(DB, "INSERT INTO automation_checkpoints (id,user_id,kind,cursor,last_success_at,next_run_at,state_json,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET cursor=excluded.cursor,last_success_at=excluded.last_success_at,next_run_at=excluded.next_run_at,state_json=excluded.state_json,updated_at=excluded.updated_at", canonicalId("automation", actor, kind), actor, kind, value.cursor ?? null, value.state === "succeeded" ? at : null, value.nextRunAt ? Date.parse(String(value.nextRunAt)) : null, JSON.stringify(nextState), at);
        return (await readCanonical<T>(input.kind, `${actor}:${kind}`, actor))!;
      }
      throw new Error("unsupported_canonical_write");
    },
    async deleteForOwner(kind, requestedId, actor) {
      if (kind !== "invite") return false;
      const id = await resolveOwnedId(DB, domain, kind, requestedId, actor, true);
      return changed(await run(DB, "UPDATE invite_links SET revoked_at=? WHERE id=? AND creator_user_id=? AND revoked_at IS NULL", Date.now(), id, actor));
    },
    async runIdempotent<T>(input: IdempotentMutation<T>) {
      const id = `idempotency_${randomUUID()}`;
      const at = new Date(input.now);
      const keyHash = createHash("sha256").update(input.key).digest("hex");
      const existing = await first(DB, "SELECT id,request_hash,status,response_json FROM idempotency_keys WHERE actor_user_id=? AND operation=? AND key_hash=?", input.actorUserId, input.operation, keyHash);
      if (existing) {
        if (existing.request_hash !== input.requestHash) throw new Error("idempotency_conflict");
        if (existing.status === "complete") return { replayed: true, value: JSON.parse(String(existing.response_json)) as T };
        // Never steal an in-flight lease based on wall-clock expiry: the old
        // runner may still be able to commit canonical effects. Known caught
        // failures are marked failed below and can be retried safely.
        if (existing.status === "processing") throw new Error("idempotency_in_progress");
        await run(DB, "DELETE FROM idempotency_keys WHERE id=? AND actor_user_id=? AND status='failed'", existing.id, input.actorUserId);
      }
      const began = await domain.idempotency.begin({ id, actorUserId: asUserId(input.actorUserId), operation: input.operation, keyHash, requestHash: input.requestHash, expiresAt: new Date(at.valueOf() + 2 * 60_000), at });
      if (began.status === "conflict") throw new Error("idempotency_conflict");
      if (began.status === "replay") {
        if (!began.responseJson) throw new Error("idempotency_in_progress");
        return { replayed: true, value: JSON.parse(began.responseJson) as T };
      }
      let executionReturned = false;
      try {
        const value = await input.execute();
        executionReturned = true;
        if (!(await domain.idempotency.complete(id, asUserId(input.actorUserId), JSON.stringify(value), new Date(input.now)))) throw new Error("idempotency_completion_failed");
        return { replayed: false, value };
      } catch (error) {
        // A missing completion receipt does not prove the effect failed. The
        // grouped services can also throw after a partial write, so retain
        // their lease until canonical effects have been investigated.
        if (!executionReturned && !input.preserveLeaseOnError) await run(DB, "UPDATE idempotency_keys SET status='failed',updated_at=? WHERE id=? AND actor_user_id=? AND status='processing'", at.valueOf(), id, input.actorUserId);
        throw error;
      }
    },
  };
}

async function listCanonicalPage<T>(DB: Database, kind: string, actor: string, options: McpPageOptions): Promise<McpRecordPage<T>> {
  const cursor = options.cursor ?? "";
  const limit = normalizeMcpPageLimit(options.limit);
  const take = limit + 1;
  const at = new Date().toISOString();
  let rows: Row[] = [];
  let mapRow: (row: Row) => McpRecord<T>;
  if (kind === "source_policy") {
    rows = await all(DB, "SELECT *,app_id AS record_id FROM connected_app_preferences WHERE user_id=? AND revoked_at IS NULL AND app_id>? ORDER BY app_id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], { sourceId: row.app_id, displayName: row.display_name, category: row.category, policy: row.access_mode, reviewedAt: row.last_reviewed_at } as T, Number(row.last_reviewed_at ?? 1), at);
  } else if (kind === "work_signal") {
    rows = await all(DB, "SELECT *,id AS record_id FROM work_signals WHERE user_id=? AND revoked_at IS NULL AND id>? ORDER BY id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], workSignalValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "networking_pulse") {
    rows = await all(DB, "SELECT *,id AS record_id FROM networking_pulses WHERE user_id=? AND id>? ORDER BY id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], pulseValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "profile_model") {
    rows = await all(DB, "SELECT p.*,h.handle,p.id AS record_id,(SELECT s.id FROM surfaces s WHERE s.kind='profile' AND s.subject_id=p.id LIMIT 1) AS surface_id,(SELECT json_group_array(topic_id) FROM profile_topic_contributions c WHERE c.user_id=p.user_id) AS canonical_topic_ids_json,(SELECT json_group_array(json_object('key',f.field_key,'value',json(f.value_json),'audience',f.audience,'allowMatching',f.allow_matching,'sourceStatus',f.source_status,'provenance',f.provenance)) FROM profile_fields f WHERE f.profile_id=p.id) AS fields_json,(SELECT json_group_array(json_object('key',s.stat_key,'label',s.label,'value',s.value,'provenance',s.provenance,'audience',s.audience)) FROM profile_statistics s WHERE s.profile_id=p.id) AS statistics_json FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.user_id=? AND p.id>? ORDER BY p.id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], profileValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "invite") {
    rows = await all(DB, "SELECT *,id AS record_id FROM invite_links WHERE creator_user_id=? AND revoked_at IS NULL AND id>? ORDER BY id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], inviteValue(row) as T, Number(row.created_at ?? 1), at);
  } else if (kind === "follow_watch") {
    rows = await all(DB, "SELECT * FROM (SELECT 'follow:'||target_kind||':'||target_id AS record_id,'follow' AS relation,target_kind,target_id,created_at FROM follows WHERE follower_user_id=? AND revoked_at IS NULL UNION ALL SELECT 'watch:'||kind||':'||target_id AS record_id,'watch' AS relation,kind AS target_kind,target_id,created_at FROM watches WHERE user_id=? AND revoked_at IS NULL) WHERE record_id>? ORDER BY record_id LIMIT ?", actor, actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], { relation: row.relation, targetKind: row.target_kind, targetId: row.target_id, enabled: true } as T, Number(row.created_at ?? 1), at);
  } else if (kind === "candidate_batch") {
    rows = await all(DB, "SELECT *,id AS record_id FROM candidate_batches WHERE user_id=? AND expires_at>? AND id>? ORDER BY id LIMIT ?", actor, Date.now(), cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], candidateBatchValue(row) as T, Number(row.created_at ?? 1), at);
  } else if (kind === "connection") {
    rows = await all(DB, "SELECT c.*,c.id AS record_id,p.user_a_id,p.user_b_id,s.muted,s.renewed_relevance_enabled,s.renewed_relevance_acknowledged_at FROM connection_sides s JOIN connections c ON c.id=s.connection_id JOIN match_pairs p ON p.id=c.match_pair_id WHERE s.user_id=? AND c.id>? ORDER BY c.id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), String(row.user_a_id), [String(row.user_a_id) === actor ? String(row.user_b_id) : String(row.user_a_id)], { id: row.record_id, state: row.state, matchId: row.match_id, sides: { [actor]: { muted: Boolean(row.muted), renewedRelevanceEnabled: Boolean(row.renewed_relevance_enabled), renewedRelevanceAcknowledgedAt: row.renewed_relevance_acknowledged_at == null ? null : new Date(Number(row.renewed_relevance_acknowledged_at)).toISOString() } } } as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "connection_private_note") {
    rows = options.filter?.connectionId
      ? await all(DB, "SELECT *,id AS record_id FROM connection_private_notes WHERE owner_user_id=? AND connection_id=? AND id>? ORDER BY id LIMIT ?", actor, options.filter.connectionId, cursor, take)
      : await all(DB, "SELECT *,id AS record_id FROM connection_private_notes WHERE owner_user_id=? AND id>? ORDER BY id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], connectionNoteValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "connection_reminder") {
    rows = options.filter?.connectionId
      ? await all(DB, "SELECT *,id AS record_id FROM connection_reminders WHERE user_id=? AND connection_id=? AND id>? ORDER BY id LIMIT ?", actor, options.filter.connectionId, cursor, take)
      : await all(DB, "SELECT *,id AS record_id FROM connection_reminders WHERE user_id=? AND id>? ORDER BY id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], connectionReminderValue(row) as T, Number(row.created_at ?? 1), at);
  } else if (kind === "room") {
    rows = await all(DB, `SELECT r.*,r.id AS record_id,
      (SELECT COUNT(*) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS message_count,
      (SELECT COUNT(DISTINCT m.sender_user_id) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS active_participant_count,
      (SELECT MAX(m.created_at) FROM messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) AS last_activity_at,
      EXISTS(SELECT 1 FROM introduction_feedback f WHERE f.connection_id=r.connection_id AND f.user_id=?) AS feedback_submitted,
      EXISTS(SELECT 1 FROM introduction_feedback f WHERE f.connection_id=r.connection_id AND f.user_id=? AND f.useful=1) AS positive_feedback,
      CASE
        WHEN EXISTS(SELECT 1 FROM room_upgrade_proposals p WHERE p.room_id=r.id AND p.status='proposed') THEN 'pending'
        WHEN EXISTS(SELECT 1 FROM room_upgrade_proposals p WHERE p.room_id=r.id AND p.status='activated') THEN 'active'
        ELSE 'none'
      END AS upgrade_state
      FROM room_memberships rm JOIN rooms r ON r.id=rm.room_id
      WHERE rm.user_id=? AND rm.left_at IS NULL AND r.id>? ORDER BY r.id LIMIT ?`, actor, actor, actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], roomValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "circle") {
    rows = await all(DB, "SELECT c.*,c.id AS record_id,(SELECT s.id FROM surfaces s WHERE s.kind='circle' AND s.subject_id=c.id LIMIT 1) AS surface_id FROM circle_memberships cm JOIN circles c ON c.id=cm.circle_id WHERE cm.user_id=? AND cm.status='active' AND c.id>? ORDER BY c.id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], circleValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "automation_checkpoint") {
    rows = await all(DB, "SELECT *,user_id||':'||kind AS record_id FROM automation_checkpoints WHERE user_id=? AND (user_id||':'||kind)>? ORDER BY record_id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], automationValue(row) as T, Number(row.updated_at ?? 1), at);
  } else return { records: [], nextCursor: null };
  const hasMore = rows.length > limit;
  const records = rows.slice(0, limit).map(mapRow!);
  return { records, nextCursor: hasMore ? records.at(-1)?.id ?? null : null };
}

async function surfaceRecord<T>(DB: Database, id: string, actor: string): Promise<McpRecord<T> | null> {
  const base = await first(DB, "SELECT * FROM surfaces WHERE id=?", id);
  if (!base || !["profile", "room", "circle"].includes(String(base.kind))) return null;

  if (base.kind === "profile") {
    const subject = await first(DB, "SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id AND u.status='active' WHERE p.id=? AND p.user_id=? AND p.user_id=?", base.subject_id, base.owner_user_id, actor);
    if (!subject) return null;
    const approvers = [String(base.owner_user_id)].filter(Boolean);
    if (approvers.length === 0) return null;
    const media = await approvedProfileMedia(DB, actor);
    const profile = await first(DB, "SELECT p.display_name AS displayName,p.summary,h.handle FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.id=? AND p.user_id=?", base.subject_id, actor);
    if (!profile) return null;
    // A profile surface is eventually public HTML. Only facts and embedded
    // project entries explicitly marked public, with confirmed provenance and
    // no cohort restriction, may cross into the generation brief. Direct
    // project rows also need an active, published, non-deleted public record.
    // The owner can still preview the base identity fields above while the
    // profile is private, but audience-scoped fields never get baked into a
    // revision that can later be published.
    const displayableFields = await all(DB, "SELECT field_key AS fieldKey,value_json AS valueJson FROM profile_fields WHERE profile_id=? AND audience='public' AND source_status='confirmed' AND cohort_scope_id IS NULL ORDER BY field_key", base.subject_id);
    const facts = displayableFields.flatMap((field) => String(field.fieldKey) === "projects" ? [] : [{ label: profileFieldLabel(String(field.fieldKey)), value: profileFactValue(field.valueJson) }]).filter((fact) => fact.value.length > 0);
    const approvedDraftProjects = displayableFields.flatMap((field) => String(field.fieldKey) === "projects" ? profileProjectsValue(field.valueJson) : []);
    const projectRows = await all(DB, "SELECT id,title,summary,slug FROM projects WHERE owner_user_id=? AND status='active' AND audience='public' AND published_at IS NOT NULL AND deleted_at IS NULL AND cohort_scope_id IS NULL ORDER BY updated_at DESC LIMIT 20", actor);
    const projects = dedupeProfileProjects([...approvedDraftProjects, ...projectRows.map((project) => ({ id: String(project.id), title: String(project.title), summary: String(project.summary), href: `/projects/${String(project.slug)}`, tags: [], metrics: [] }))]);
    const authorizedContent = {
      "profile.displayName": String(profile.displayName),
      "profile.summary": String(profile.summary),
      "profile.facts": facts,
      "profile.projects": projects,
      ...Object.fromEntries(media.map((item) => [item.altKey, item.altText])),
    };
    const requiredBindings = ["profile.displayName", "profile.summary", ...(facts.length ? ["profile.facts"] : []), ...(projects.length ? ["profile.projects"] : [])];
    return record("surface", id, String(base.owner_user_id), [], {
      kind: "profile", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: base.governance_version,
      allowedModules: ["profile.identity", "profile.current_work", "profile.projects"],
      authorizedBindings: ["profile.displayName", "profile.summary", "profile.facts", "profile.projects", ...media.flatMap((item) => [item.key, item.altKey])],
      authorizedBindingTypes: { "profile.displayName": "text", "profile.summary": "text", "profile.facts": "facts", "profile.projects": "projects", ...Object.fromEntries(media.flatMap((item) => [[item.key, "media"], [item.altKey, "text"]])) },
      authorizedContent,
      requiredBindings,
      authorizedMedia: media.map(({ key, altKey, assetId, projectTitle }) => ({ key, altKey, label: `${projectTitle} image`, approvedAssetIds: [assetId] })),
      approvedAssets: media.map(({ assetId, src }) => ({ id: assetId, src })),
      trustedComponents: [...designPolicy.trustedComponents],
      governance: { mode: "owner", ownerUserId: base.owner_user_id, requiredApproverIds: approvers, governanceVersion: base.governance_version },
    } as T, Number(base.governance_version), new Date(Number(base.updated_at)).toISOString());
  }

  if (base.kind === "room") {
    const subject = await first(DB, "SELECT r.id FROM rooms r JOIN room_memberships current ON current.room_id=r.id AND current.user_id=? AND current.left_at IS NULL JOIN users u ON u.id=current.user_id AND u.status='active' WHERE r.id=? AND r.status='active'", actor, base.subject_id);
    if (!subject) return null;
    const members = await all(DB, "SELECT rm.user_id FROM room_memberships rm JOIN users u ON u.id=rm.user_id AND u.status='active' WHERE rm.room_id=? AND rm.left_at IS NULL ORDER BY rm.user_id", base.subject_id);
    const memberIds = members.map((member) => String(member.user_id)).filter(Boolean);
    if (memberIds.length === 0 || !memberIds.includes(actor)) return null;
    const [context, snapshots, media] = await Promise.all([
      first(DB, `SELECT COALESCE(topic.label,'Introduction room') AS themeTopic,context.reason,context.shared_context_json AS sharedContextJson
        FROM rooms room LEFT JOIN topics topic ON topic.id=room.theme_topic_id
        LEFT JOIN connection_context_snapshots context ON context.connection_id=room.connection_id WHERE room.id=?`, base.subject_id),
      all(DB, `SELECT snapshot.display_name AS displayName,snapshot.summary
        FROM rooms room JOIN connection_snapshots snapshot ON snapshot.connection_id=room.connection_id
        WHERE room.id=? ORDER BY snapshot.display_name LIMIT 20`, base.subject_id),
      approvedSharedSurfaceMedia(DB, id),
    ]);
    const sharedFacts = safeStringArray(context?.sharedContextJson).map((value, index) => ({ label: `Shared context ${index + 1}`, value }));
    const publicProfiles = snapshots.map((snapshot) => ({ label: String(snapshot.displayName ?? "Buildmate"), value: String(snapshot.summary ?? "") })).filter((item) => item.value.length > 0);
    const authorizedContent = {
      "room.title": String(context?.themeTopic ?? "Introduction room"),
      "room.whyTitle": "Why Buildmates connected you",
      "room.whyBody": String(context?.reason ?? "Buildmates found mutual relevance in your current work."),
      "room.sharedFacts": sharedFacts.length ? sharedFacts : publicProfiles,
      "room.privacyNote": "Only context approved for both people appears here. Messages stay inside this room and never become design bindings.",
      ...Object.fromEntries(media.map((item) => [item.altKey, item.altText])),
    };
    return record("surface", id, String(base.owner_user_id), memberIds.filter((user) => user !== base.owner_user_id), {
      kind: "room", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: base.governance_version,
      allowedModules: ["room.introduction", "room.chat"],
      authorizedBindings: ["room.title", "room.whyTitle", "room.whyBody", "room.sharedFacts", "room.privacyNote", ...media.flatMap((item) => [item.key, item.altKey])],
      authorizedBindingTypes: { "room.title": "text", "room.whyTitle": "text", "room.whyBody": "text", "room.sharedFacts": "facts", "room.privacyNote": "text", ...Object.fromEntries(media.flatMap((item) => [[item.key, "media"], [item.altKey, "text"]])) },
      authorizedContent,
      requiredBindings: ["room.title", "room.whyBody"],
      authorizedMedia: media.map(({ key, altKey, assetId }) => ({ key, altKey, label: "Shared room image", approvedAssetIds: [assetId] })),
      approvedAssets: media.map(({ assetId, src }) => ({ id: assetId, src })),
      trustedComponents: [...designPolicy.trustedComponents],
      governance: { mode: "unanimous_members", memberUserIds: memberIds, requiredApproverIds: memberIds, requiredApprovals: memberIds.length, governanceVersion: base.governance_version },
    } as T, Number(base.governance_version), new Date(Number(base.updated_at)).toISOString());
  }

  const circle = await first(DB, "SELECT c.governance_mode,c.governance_version FROM circles c JOIN circle_memberships current ON current.circle_id=c.id AND current.user_id=? AND current.status='active' JOIN users u ON u.id=current.user_id AND u.status='active' WHERE c.id=? AND c.status='active'", actor, base.subject_id);
  if (!circle) return null;
  const members = await all(DB, "SELECT cm.user_id,cm.role,COALESCE(profile.display_name,'Buildmate') AS display_name FROM circle_memberships cm JOIN users u ON u.id=cm.user_id AND u.status='active' LEFT JOIN profiles profile ON profile.user_id=cm.user_id WHERE cm.circle_id=? AND cm.status='active' ORDER BY profile.display_name,cm.user_id", base.subject_id);
  const memberIds = members.map((member) => String(member.user_id)).filter(Boolean);
  if (memberIds.length === 0 || !memberIds.includes(actor)) return null;
  const modules = await all(DB, "SELECT kind FROM circle_modules WHERE circle_id=? AND active=1 ORDER BY kind LIMIT 20", base.subject_id);
  const [circleDetails, metrics, media] = await Promise.all([
    first(DB, "SELECT name,purpose FROM circles WHERE id=?", base.subject_id),
    all(DB, "SELECT name FROM circle_metrics WHERE circle_id=? ORDER BY name LIMIT 20", base.subject_id),
    approvedSharedSurfaceMedia(DB, id),
  ]);
  const memberFacts = members.map((member) => ({ label: String(member.display_name ?? "Buildmate"), value: ["owner", "admin"].includes(String(member.role)) ? String(member.role) : "member" }));
  const moduleFacts = modules.map((module) => ({ label: moduleLabel(String(module.kind)), value: "Active" }));
  const metricFacts = metrics.map((metric) => ({ label: String(metric.name), value: "Tracked" }));
  const common = {
    kind: "circle", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: circle.governance_version,
    allowedModules: ["circle.identity", "circle.members", ...modules.map((module) => `circle.${String(module.kind)}`)],
    authorizedBindings: ["circle.name", "circle.purpose", "circle.members", "circle.modules", "circle.metrics", ...media.flatMap((item) => [item.key, item.altKey])],
    authorizedBindingTypes: { "circle.name": "text", "circle.purpose": "text", "circle.members": "facts", "circle.modules": "facts", "circle.metrics": "facts", ...Object.fromEntries(media.flatMap((item) => [[item.key, "media"], [item.altKey, "text"]])) },
    authorizedContent: { "circle.name": String(circleDetails?.name ?? "Build Circle"), "circle.purpose": String(circleDetails?.purpose ?? "A shared space for builders."), "circle.members": memberFacts, "circle.modules": moduleFacts, "circle.metrics": metricFacts, ...Object.fromEntries(media.map((item) => [item.altKey, item.altText])) },
    requiredBindings: ["circle.name", "circle.purpose", ...(memberFacts.length ? ["circle.members"] : []), ...(moduleFacts.length ? ["circle.modules"] : [])],
    authorizedMedia: media.map(({ key, altKey, assetId }) => ({ key, altKey, label: "Shared Circle image", approvedAssetIds: [assetId] })),
    approvedAssets: media.map(({ assetId, src }) => ({ id: assetId, src })),
    trustedComponents: [...designPolicy.trustedComponents],
  };
  if (circle.governance_mode === "vote") {
    return record("surface", id, String(base.owner_user_id), memberIds.filter((user) => user !== base.owner_user_id), { ...common, governance: { mode: "circle_vote", memberUserIds: memberIds, eligibleVoterIds: memberIds, requiredApproverIds: memberIds, approvalRule: "strict_majority", governanceVersion: circle.governance_version } } as T, Number(base.governance_version), new Date(Number(base.updated_at)).toISOString());
  }
  if (circle.governance_mode !== "admin") return null;
  const publishers = members.filter((member) => ["admin", "owner"].includes(String(member.role))).map((member) => String(member.user_id));
  if (publishers.length === 0) return null;
  return record("surface", id, String(base.owner_user_id), memberIds.filter((user) => user !== base.owner_user_id), { ...common, governance: { mode: "circle_admin", memberUserIds: memberIds, publisherUserIds: publishers, requiredApproverIds: publishers, governanceVersion: circle.governance_version } } as T, Number(base.governance_version), new Date(Number(base.updated_at)).toISOString());
}

function profileFieldLabel(key: string) {
  return ({ current_work: "Current work", interests: "Interests", ambitions: "Ambitions", exploring: "Exploring", networking_intent: "Who I want to meet" } as Record<string, string>)[key] ?? key.replaceAll("_", " ");
}

function profileFactValue(raw: unknown): string {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(", ");
    return "";
  } catch { return ""; }
}

type BoundProfileProject = { id: string; title: string; summary: string; href?: string; tags?: string[]; metrics?: Array<{ label: string; value: string }> };
function profileProjectsValue(raw: unknown): BoundProfileProject[] {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const project = item as Record<string, unknown>;
      if (typeof project.id !== "string" || typeof project.title !== "string" || typeof project.summary !== "string") return [];
      return [{ id: project.id, title: project.title, summary: project.summary, tags: Array.isArray(project.tags) ? project.tags.filter((tag): tag is string => typeof tag === "string") : [], metrics: Array.isArray(project.metrics) ? project.metrics.flatMap((metric) => metric && typeof metric === "object" && typeof (metric as Record<string, unknown>).label === "string" && typeof (metric as Record<string, unknown>).value === "string" ? [{ label: String((metric as Record<string, unknown>).label), value: String((metric as Record<string, unknown>).value) }] : []) : [] }];
    });
  } catch { return []; }
}

function dedupeProfileProjects(projects: BoundProfileProject[]) {
  const seen = new Set<string>();
  return projects.filter((project) => !seen.has(project.id) && (seen.add(project.id), true)).slice(0, 20);
}

async function approvedProfileMedia(DB: Database, actor: string) {
  const [projectRows, profileRows] = await Promise.all([
    all(DB, `SELECT media.asset_id AS assetId,media.alt_text AS altText,project.title AS projectTitle,asset.object_key AS objectKey
    FROM project_media media
    JOIN projects project ON project.id=media.project_id
    JOIN surface_assets asset ON asset.id=media.asset_id
    WHERE project.owner_user_id=? AND project.status='active' AND project.audience='public'
      AND project.published_at IS NOT NULL AND project.deleted_at IS NULL AND project.cohort_scope_id IS NULL
      AND asset.owner_user_id=? AND asset.deleted_at IS NULL
    ORDER BY project.updated_at DESC,media.position,media.id LIMIT 24`, actor, actor),
    all(DB, `SELECT media.asset_id AS assetId,media.alt_text AS altText,media.project_key AS projectKey,
      field.value_json AS projectsJson,asset.object_key AS objectKey
    FROM profile_project_media media
    JOIN profiles profile ON profile.id=media.profile_id
    JOIN profile_fields field ON field.profile_id=profile.id AND field.field_key='projects'
      AND field.audience='public' AND field.source_status='confirmed' AND field.cohort_scope_id IS NULL
    JOIN surface_assets asset ON asset.id=media.asset_id
    WHERE profile.user_id=? AND asset.owner_user_id=? AND asset.deleted_at IS NULL
    ORDER BY media.updated_at DESC LIMIT 24`, actor, actor),
  ]);
  const approvedDraftMedia: Row[] = profileRows.flatMap((row): Row[] => {
    const project = profileProjectsValue(row.projectsJson).find((item) => item.id === String(row.projectKey));
    return project ? [{ ...row, projectTitle: project.title } as Row] : [];
  });
  const seen = new Set<string>();
  return [...approvedDraftMedia, ...projectRows].flatMap((row) => {
    const assetId = String(row.assetId ?? "");
    const objectKey = String(row.objectKey ?? "");
    const prefix = `surface-assets/${actor}/`;
    if (seen.has(assetId) || !/^asset_[a-z0-9_-]{8,80}$/i.test(assetId) || !objectKey.startsWith(prefix) || !String(row.altText ?? "").trim()) return [];
    let binding;
    try { binding = profileMediaBinding(assetId); } catch { return []; }
    seen.add(assetId);
    return [{ ...binding, assetId, src: `/api/surface-assets/${actor}/${objectKey.slice(prefix.length)}`, altText: String(row.altText).trim().slice(0, 300), projectTitle: String(row.projectTitle ?? "Project") }];
  });
}

async function approvedSharedSurfaceMedia(DB: Database, surfaceId: string) {
  const rows = await all(DB, `SELECT attachment.asset_id AS assetId,attachment.binding_key AS bindingKey,attachment.alt_text AS altText,
      asset.owner_user_id AS ownerUserId,asset.object_key AS objectKey
    FROM surface_asset_attachments attachment JOIN surface_assets asset ON asset.id=attachment.asset_id
    WHERE attachment.surface_id=? AND attachment.revoked_at IS NULL AND asset.deleted_at IS NULL
    ORDER BY attachment.created_at,attachment.id LIMIT 24`, surfaceId);
  return rows.flatMap((row) => {
    const assetId = String(row.assetId ?? "");
    const ownerUserId = String(row.ownerUserId ?? "");
    const objectKey = String(row.objectKey ?? "");
    const prefix = `surface-assets/${ownerUserId}/`;
    const bindingKey = String(row.bindingKey ?? "");
    if (!/^asset_[a-z0-9_-]{8,80}$/i.test(assetId) || bindingKey !== `surface.media.${assetId.toLowerCase().replace(/[^a-z0-9_-]/g, "")}` || !objectKey.startsWith(prefix)) return [];
    return [{ key: bindingKey, altKey: `${bindingKey}.alt`, assetId, src: `/api/surface-assets/${ownerUserId}/${objectKey.slice(prefix.length)}`, altText: String(row.altText ?? "").trim().slice(0, 300) }];
  }).filter((item) => item.altText.length > 0);
}

function safeStringArray(raw: unknown): string[] {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 20) : [];
  } catch { return []; }
}

function moduleLabel(kind: string) {
  return ({ resource_shelf: "Resource shelf", experiment_tracker: "Experiment tracker", decision_log: "Decision log", feedback_queue: "Feedback queue", milestone_tracker: "Milestone tracker", scoreboard: "Scoreboard" } as Record<string, string>)[kind] ?? "Shared tool";
}

async function surfaceReadyToPublish(DB: Database, surfaceId: string, revisionId: string, actor: string): Promise<boolean> {
  const surface = await first(DB, "SELECT kind,subject_id FROM surfaces WHERE id=?", surfaceId);
  if (!surface) return false;
  if (surface.kind === "profile") return true;
  if (surface.kind === "room") {
    const missing = await first(DB, "SELECT COUNT(*) AS count FROM room_memberships rm WHERE rm.room_id=? AND rm.left_at IS NULL AND NOT EXISTS(SELECT 1 FROM surface_approvals a WHERE a.revision_id=? AND a.user_id=rm.user_id AND a.decision='approved')", surface.subject_id, revisionId);
    return Number(missing?.count ?? 1) === 0;
  }
  const circle = await first(DB, "SELECT governance_mode FROM circles WHERE id=?", surface.subject_id);
  if (circle?.governance_mode === "admin") return Boolean(await first(DB, "SELECT 1 AS ok FROM circle_memberships WHERE circle_id=? AND user_id=? AND status='active' AND role IN ('admin','owner')", surface.subject_id, actor));
  return Boolean(await first(DB, "SELECT 1 AS ok FROM circle_proposals WHERE circle_id=? AND kind='design' AND status='approved' AND json_extract(payload_json,'$.revisionId')=?", surface.subject_id, revisionId));
}

async function assertProposalMember(DB: Database, proposalId: string, actor: string) { if (!(await first(DB, "SELECT 1 AS ok FROM match_proposals mp JOIN match_pairs p ON p.id=mp.match_pair_id WHERE mp.id=? AND ? IN (p.user_a_id,p.user_b_id)", proposalId, actor))) throw new Error("object_not_authorized"); }
async function assertConnectionMember(DB: Database, connectionId: string, actor: string) { if (!(await first(DB, "SELECT 1 AS ok FROM connections c JOIN match_pairs p ON p.id=c.match_pair_id WHERE c.id=? AND ? IN (p.user_a_id,p.user_b_id)", connectionId, actor))) throw new Error("object_not_authorized"); }
async function assertRoomMember(DB: Database, roomId: string, actor: string) { if (!(await first(DB, "SELECT 1 AS ok FROM room_memberships WHERE room_id=? AND user_id=? AND left_at IS NULL", roomId, actor))) throw new Error("object_not_authorized"); }

async function ensureCircleDesignProposal(
  DB: Database,
  domain: ReturnType<typeof createD1Repositories>,
  circleId: string,
  revisionId: string,
  actor: string,
  governanceVersion: number,
  at: number,
): Promise<string> {
  const existing = await first(DB, "SELECT id FROM circle_proposals WHERE circle_id=? AND kind='design' AND governance_version=? AND json_extract(payload_json,'$.revisionId')=?", circleId, governanceVersion, revisionId);
  if (existing) return String(existing.id);
  const proposalId = canonicalId("circle_design_proposal", actor, `${circleId}:${revisionId}:${governanceVersion}`);
  await domain.circles.createProposal({ actorId: asUserId(actor), id: proposalId, circleId: circleId as never, kind: "design", payloadJson: JSON.stringify({ revisionId }), governanceVersion, at: new Date(at) });
  return proposalId;
}

async function resolveOwnedId(
  DB: Database,
  domain: ReturnType<typeof createD1Repositories>,
  kind: string,
  requestedId: string,
  actor: string,
  forWrite: boolean,
): Promise<string> {
  const owned: Record<string, [string, string]> = {
    work_signal: ["work_signals", "user_id"],
    networking_pulse: ["networking_pulses", "user_id"],
    profile_model: ["profiles", "user_id"],
    invite: ["invite_links", "creator_user_id"],
    candidate_evaluation: ["codex_evaluations", "user_id"],
    manual_match_response: ["human_responses", "user_id"],
    connection_private_note: ["connection_private_notes", "owner_user_id"],
    connection_reminder: ["connection_reminders", "user_id"],
    intro_feedback: ["introduction_feedback", "user_id"],
  };
  const table = owned[kind];
  if (table && await first(DB, `SELECT 1 AS ok FROM ${table[0]} WHERE id=? AND ${table[1]}=?`, requestedId, actor)) return requestedId;
  if (kind === "surface_revision") {
    if (forWrite) {
      if (await first(DB, "SELECT 1 AS ok FROM surface_revisions WHERE id=? AND author_user_id=?", requestedId, actor)) return requestedId;
    } else if (await domain.surfaces.findRevisionForViewer(requestedId, asUserId(actor))) return requestedId;
  }
  if (kind === "calendar_receipt" && await first(DB, "SELECT 1 AS ok FROM calendar_event_receipts receipt JOIN room_memberships rm ON rm.room_id=receipt.room_id WHERE receipt.id=? AND rm.user_id=? AND rm.left_at IS NULL", requestedId, actor)) return requestedId;
  return canonicalId(kind, actor, requestedId);
}

async function ownedRow<T>(DB: Database, kind: string, id: string, actor: string, table: string, ownerColumn: string, mapper: (row: Row) => unknown, idExpression = "id"): Promise<McpRecord<T> | null> {
  const row = await first(DB, `SELECT * FROM ${table} WHERE ${idExpression}=? AND ${ownerColumn}=?`, id, actor);
  return row ? record(kind, id, actor, [], mapper(row) as T, Number(row.updated_at ?? row.created_at ?? 1), new Date(Number(row.updated_at ?? row.created_at ?? Date.now())).toISOString()) : null;
}

function record<T>(kind: string, id: string, ownerUserId: string, memberUserIds: string[], value: T, version: number, updatedAt: string): McpRecord<T> { return { kind, id, ownerUserId, memberUserIds, value, version, createdAt: updatedAt, updatedAt }; }
async function followWatchRecord<T>(DB: Database, id: string, actor: string, at: string): Promise<McpRecord<T> | null> {
  const [relation, targetKind, ...targetParts] = id.split(":");
  const targetId = targetParts.join(":");
  if (!targetId || !["follow", "watch"].includes(relation)) return null;
  const row = relation === "follow"
    ? await first(DB, "SELECT target_kind AS targetKind,target_id AS targetId,created_at AS createdAt FROM follows WHERE follower_user_id=? AND target_kind=? AND target_id=? AND revoked_at IS NULL", actor, targetKind, targetId)
    : await first(DB, "SELECT kind AS targetKind,target_id AS targetId,created_at AS createdAt FROM watches WHERE user_id=? AND kind=? AND target_id=? AND revoked_at IS NULL", actor, targetKind, targetId);
  return row ? record("follow_watch", id, actor, [], { relation, targetKind: row.targetKind, targetId: row.targetId, enabled: true } as T, Number(row.createdAt ?? 1), at) : null;
}
function canonicalId(kind: string, actor: string, clientId: string) { return `${kind}_${createHash("sha256").update(`${actor}\0${clientId}`).digest("hex").slice(0, 32)}`; }
function changed(result: { meta?: { changes?: number } }) { return Number(result.meta?.changes ?? 0) > 0; }
async function run(DB: Database, sql: string, ...values: unknown[]) { return DB.prepare(sql).bind(...values).run(); }
async function first(DB: Database, sql: string, ...values: unknown[]) { return DB.prepare(sql).bind(...values).first<Row>(); }
async function all(DB: Database, sql: string, ...values: unknown[]) { return (await DB.prepare(sql).bind(...values).all<Row>()).results; }
function rowValue(row: Row) { return row; }
function workSignalValue(row: Row) { return { signalId: row.id, sourceId: row.source_app_id, taxonomyVersion: row.taxonomy_version_id, summary: row.free_text_summary, canonicalTopicIds: JSON.parse(String(row.canonical_topic_ids_json)), canonicalToolIds: JSON.parse(String(row.canonical_tool_ids_json)), canonicalDomainIds: JSON.parse(String(row.canonical_domain_ids_json)), canonicalStageIds: JSON.parse(String(row.canonical_stage_ids_json ?? "[]")), canonicalCollaborationIntentIds: JSON.parse(String(row.canonical_collaboration_intent_ids_json ?? "[]")), audience: row.audience, allowMatching: Boolean(row.allow_matching), expiresAt: new Date(Number(row.expires_at)).toISOString(), approved: true }; }
function pulseValue(row: Row) { const controls = JSON.parse(String(row.controls_json ?? "{}")); return { pulseId: row.id, intentSummary: row.intent_summary, builderSimilarity: Number(row.similar_adjacent) < 34 ? "similar" : Number(row.similar_adjacent) > 66 ? "adjacent" : "balanced", geography: Number(row.local_global) < 34 ? "local" : Number(row.local_global) > 66 ? "global" : "balanced", maximumIntroductionsPerWeek: controls.maximumIntroductionsPerWeek, serendipity: row.serendipity, timezone: controls.timezone, quietHours: controls.quietHours ?? [], snoozedUntil: controls.snoozedUntil ?? null, exclusions: controls.exclusions ?? [], startsAt: new Date(Number(row.starts_at)).toISOString(), expiresAt: new Date(Number(row.expires_at)).toISOString() }; }
function profileValue(row: Row) { return { profileId: row.id, surfaceId: String(row.surface_id ?? `surface_profile_${row.id}`), handle: row.handle, displayName: row.display_name, builderSummary: row.summary, projectOrInterest: row.project_or_interest, portfolioLinks: JSON.parse(String(row.portfolio_links_json ?? "[]")), publicationStatus: row.published_at ? "published" : "private_draft", allowMatching: Boolean(row.allow_matching), matchingReviewedAt: row.matching_reviewed_at == null ? null : new Date(Number(row.matching_reviewed_at)).toISOString(), acceptanceMode: row.acceptance_mode, coarseLocation: row.coarse_location ?? undefined, locationMapOptIn: Boolean(row.location_map_opt_in), timezone: row.timezone ?? undefined, canonicalTopicIds: JSON.parse(String(row.canonical_topic_ids_json ?? "[]")), fields: JSON.parse(String(row.fields_json ?? "[]")).map((field: Row) => ({ ...field, allowMatching: Boolean(field.allowMatching) })), statistics: JSON.parse(String(row.statistics_json ?? "[]")), publishedAt: row.published_at ? new Date(Number(row.published_at)).toISOString() : null }; }
function inviteValue(row: Row) { return { inviteId: row.id, kind: row.kind, headline: row.headline, targetId: row.target_id, maximumUses: row.maximum_uses, uses: row.use_count, expiresAt: new Date(Number(row.expires_at)).toISOString(), status: row.revoked_at ? "revoked" : "active" }; }

async function assertInviteTarget(DB:Database,actor:string,kind:string,targetId:string|null){if(kind==="personal"){if(targetId)throw new Error("invalid_invite_target");return}if(!targetId)throw new Error("invalid_invite_target");const row=kind==="builder"?await first(DB,"SELECT 1 AS ok FROM profiles WHERE id=? AND user_id=?",targetId,actor):kind==="connection_card"?await first(DB,"SELECT 1 AS ok FROM projects WHERE id=? AND owner_user_id=? AND status<>'deleted'",targetId,actor):null;if(!row)throw new Error("object_not_found_or_not_authorized")}
async function assertFollowWatchTarget(DB:Database,actor:string,relation:string,targetKind:string,targetId:string){if(relation==="watch"){if(targetKind!=="relevant_builder"||targetId!=="network")throw new Error("invalid_follow_watch_target");return}if(relation!=="follow")throw new Error("invalid_follow_watch_target");let row:Row|null=null;if(targetKind==="profile")row=await visibleProfileTarget(DB,actor,targetId);else if(targetKind==="project")row=await first(DB,"SELECT 1 AS ok FROM projects x JOIN profiles p ON p.user_id=x.owner_user_id JOIN users u ON u.id=x.owner_user_id WHERE x.id=? AND x.owner_user_id<>? AND u.status='active' AND p.published_at IS NOT NULL AND x.status='active' AND x.published_at IS NOT NULL AND x.audience IN ('public','signed_in') AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=x.owner_user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=x.owner_user_id)))",targetId,actor,actor,actor);else if(targetKind==="topic")row=await first(DB,"SELECT 1 AS ok FROM topics t JOIN taxonomy_versions v ON v.id=t.taxonomy_version_id WHERE t.id=? AND v.status='active'",targetId);if(!row)throw new Error("object_not_found_or_not_authorized")}
async function visibleProfileTarget(DB:Database,actor:string,targetId:string){return first(DB,"SELECT 1 AS ok FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.user_id<>? AND u.status='active' AND p.published_at IS NOT NULL AND p.audience IN ('public','signed_in') AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=p.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=p.user_id)))",targetId,actor,actor,actor)}
function candidateBatchValue(row: Row) { return { batchId: row.id, indexVersion: row.index_version, taxonomyVersion: row.taxonomy_version, candidateIds: JSON.parse(String(row.candidate_ids_json ?? "[]")), expiresAt: new Date(Number(row.expires_at)).toISOString() }; }
function connectionNoteValue(row: Row) { return { connectionId: row.connection_id, body: row.body, createdAt: new Date(Number(row.created_at)).toISOString(), updatedAt: new Date(Number(row.updated_at)).toISOString() }; }
function connectionReminderValue(row: Row) { return { connectionId: row.connection_id, remindAt: new Date(Number(row.remind_at)).toISOString(), status: row.status }; }
function roomValue(row: Row) {
  const messageCount = Number(row.message_count ?? 0);
  const activeParticipantCount = Number(row.active_participant_count ?? 0);
  return {
    roomId: row.id,
    connectionId: row.connection_id,
    status: row.status,
    themeTopicId: row.theme_topic_id ?? null,
    conversation: {
      messageCount,
      meaningful: messageCount >= 4 && activeParticipantCount >= 2,
      lastActivityAt: row.last_activity_at == null ? null : new Date(Number(row.last_activity_at)).toISOString(),
    },
    feedback: {
      submittedByViewer: Boolean(row.feedback_submitted),
      positiveFromViewer: Boolean(row.positive_feedback),
    },
    upgradeState: row.upgrade_state ?? "none",
  };
}
function circleValue(row: Row) { return { circleId: row.id, surfaceId: row.surface_id ?? null, name: row.name, purpose: row.purpose, status: row.status, governanceMode: row.governance_mode, governanceVersion: row.governance_version }; }
function calendarValue(row: Row) { return { roomId: row.room_id, meetingProposalId: row.meeting_proposal_id, provider: row.provider, providerEventId: row.provider_event_id, startsAt: new Date(Number(row.starts_at)).toISOString(), endsAt: new Date(Number(row.ends_at)).toISOString(), participantLabels: JSON.parse(String(row.participant_labels_json)), status: row.status }; }
function automationValue(row: Row) { const state = JSON.parse(String(row.state_json)); return { ...state, kind: row.kind, cursor: row.cursor, state: state.state, lastOutcome: state.lastOutcome, enabled: state.enabled ?? state.state !== "disabled", cadence: state.cadence ?? null, sourceLivenessReviewed: state.sourceLivenessReviewed ?? false, nextRunAt: row.next_run_at ? new Date(Number(row.next_run_at)).toISOString() : null }; }
