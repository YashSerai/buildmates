import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import { asUserId } from "@buildmates/domain";
import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, designPolicy, type SurfaceSpec } from "@buildmates/surfaces";
import { canonicalFollowWatchId, type IdempotentMutation, type McpPageOptions, type McpProductRepository, type McpRecord, type McpRecordPage, type McpRecordWrite } from "./repository";

type BoundStatement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta?: { changes?: number } }> };
type Statement = BoundStatement & { bind(...values: unknown[]): BoundStatement };
type Database = { prepare(sql: string): Statement; batch(statements: BoundStatement[]): Promise<unknown[]> };
type Row = Record<string, unknown>;

const OWNED_ID_KINDS = new Set(["work_signal", "networking_pulse", "profile_model", "invite", "candidate_evaluation", "manual_match_response", "connection_private_note", "connection_reminder", "intro_feedback", "surface_revision", "calendar_receipt"]);

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
      const row = await first(DB, "SELECT p.*,h.handle FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.id=? AND (p.user_id=? OR p.audience IN ('public','signed_in'))", id, actor);
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
      const row = await first(DB, "SELECT r.* FROM rooms r JOIN room_memberships rm ON rm.room_id=r.id WHERE r.id=? AND rm.user_id=? AND rm.left_at IS NULL", requestedId, actor);
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
      return surface ? record(kind, revision.id, revision.authorUserId, revision.visibility === "personal_view" ? [] : surface.memberUserIds, { surfaceId: revision.surfaceId, revisionNumber: revision.revisionNumber, baseRevisionNumber: revision.baseRevisionNumber, visibility: revision.visibility ?? "private_preview", spec: JSON.parse(revision.specJson), status: "stored" } as T, revision.revisionNumber, revision.createdAt.toISOString()) : null;
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

  return {
    readForMember: readCanonical,
    async listForMember<T>(kind: string, actor: string) {
      return (await listCanonicalPage<T>(DB, kind, actor, { limit: 50 })).records;
    },
    async listPageForMember<T>(kind: string, actor: string, options: McpPageOptions) {
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
        const profileId = canonicalId("profile", actor, "primary");
        const publishedAt = value.audience === "public" ? at : null;
        const statements = [
            DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,coarse_location,location_map_opt_in,timezone,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,portfolio_links_json=excluded.portfolio_links_json,audience=excluded.audience,allow_matching=excluded.allow_matching,acceptance_mode=excluded.acceptance_mode,indexable=excluded.indexable,coarse_location=excluded.coarse_location,location_map_opt_in=excluded.location_map_opt_in,timezone=excluded.timezone,published_at=excluded.published_at,updated_at=excluded.updated_at").bind(profileId, actor, value.displayName, value.builderSummary, value.projectOrInterest, JSON.stringify(value.portfolioLinks ?? []), value.audience, value.allowMatching ? 1 : 0, value.acceptanceMode, value.audience === "public" ? 1 : 0, value.coarseLocation || null, value.locationMapOptIn ? 1 : 0, value.timezone || null, publishedAt, at, at),
          DB.prepare("INSERT INTO handles (user_id,handle,normalized_handle,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle").bind(actor, value.handle, String(value.handle).toLowerCase(), at),
        ];
        if (Array.isArray(value.statistics)) {
          statements.push(DB.prepare("DELETE FROM profile_statistics WHERE profile_id=?").bind(profileId));
          for (const statistic of value.statistics as Row[]) statements.push(DB.prepare("INSERT INTO profile_statistics (profile_id,stat_key,label,value,provenance,audience,updated_at) VALUES (?,?,?,?,?,?,?)").bind(profileId, statistic.key, statistic.label, statistic.value, statistic.provenance, statistic.audience, at));
          }
          await DB.batch(statements);
          const surfaceId = `surface_profile_${profileId}`;
          if (!await first(DB, "SELECT id FROM surfaces WHERE id=?", surfaceId)) {
            await domain.surfaces.createSurface({ actorId: asUserId(actor), id: surfaceId, ownerUserId: asUserId(actor), kind: "profile", subjectId: profileId, at: new Date(at) });
          }
          return (await readCanonical<T>(input.kind, profileId, actor))!;
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
      if (input.kind === "surface_revision") {
        const surfaceId = String(value.surfaceId);
        const surface = await surfaceRecord<Row>(DB, surfaceId, actor);
        if (!surface) throw new Error("object_not_authorized");
        const current = await first(DB, "SELECT COALESCE(MAX(revision_number),0) AS maximum FROM surface_revisions WHERE surface_id=?", surfaceId);
        const base = value.baseRevisionId ? await first(DB, "SELECT revision_number FROM surface_revisions WHERE id=? AND surface_id=?", String(value.baseRevisionId), surfaceId) : await first(DB, "SELECT revision_number FROM surface_revisions WHERE id=(SELECT published_revision_id FROM surfaces WHERE id=?)", surfaceId);
        if (value.baseRevisionId && !base) throw new Error("surface_base_not_found");
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
          configured: value.state !== "disabled",
          enabled: value.enabled ?? value.state !== "disabled",
          cadence: value.cadence ?? previousState.cadence ?? null,
          sourceLivenessReviewed: value.sourceLivenessReviewed ?? previousState.sourceLivenessReviewed ?? false,
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
      try {
        const value = await input.execute();
        if (!(await domain.idempotency.complete(id, asUserId(input.actorUserId), JSON.stringify(value), new Date(input.now)))) throw new Error("idempotency_completion_failed");
        return { replayed: false, value };
      } catch (error) {
        await run(DB, "UPDATE idempotency_keys SET status='failed',updated_at=? WHERE id=? AND actor_user_id=? AND status='processing'", at.valueOf(), id, input.actorUserId);
        throw error;
      }
    },
  };
}

async function listCanonicalPage<T>(DB: Database, kind: string, actor: string, options: McpPageOptions): Promise<McpRecordPage<T>> {
  const cursor = options.cursor ?? "";
  const take = Math.min(Math.max(options.limit, 1), 50) + 1;
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
    rows = await all(DB, "SELECT p.*,h.handle,p.id AS record_id FROM profiles p LEFT JOIN handles h ON h.user_id=p.user_id WHERE p.user_id=? AND p.id>? ORDER BY p.id LIMIT ?", actor, cursor, take);
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
    rows = await all(DB, "SELECT r.*,r.id AS record_id FROM room_memberships rm JOIN rooms r ON r.id=rm.room_id WHERE rm.user_id=? AND rm.left_at IS NULL AND r.id>? ORDER BY r.id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], roomValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "circle") {
    rows = await all(DB, "SELECT c.*,c.id AS record_id,(SELECT s.id FROM surfaces s WHERE s.kind='circle' AND s.subject_id=c.id LIMIT 1) AS surface_id FROM circle_memberships cm JOIN circles c ON c.id=cm.circle_id WHERE cm.user_id=? AND cm.status='active' AND c.id>? ORDER BY c.id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], circleValue(row) as T, Number(row.updated_at ?? 1), at);
  } else if (kind === "automation_checkpoint") {
    rows = await all(DB, "SELECT *,user_id||':'||kind AS record_id FROM automation_checkpoints WHERE user_id=? AND (user_id||':'||kind)>? ORDER BY record_id LIMIT ?", actor, cursor, take);
    mapRow = (row) => record(kind, String(row.record_id), actor, [], automationValue(row) as T, Number(row.updated_at ?? 1), at);
  } else return { records: [], nextCursor: null };
  const hasMore = rows.length > options.limit;
  const records = rows.slice(0, options.limit).map(mapRow!);
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
    return record("surface", id, String(base.owner_user_id), [], {
      kind: "profile", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: base.governance_version,
      allowedModules: ["profile.identity", "profile.current_work", "profile.projects"],
      authorizedBindings: ["profile.displayName", "profile.summary", "profile.facts", "profile.projects"],
      authorizedBindingTypes: { "profile.displayName": "text", "profile.summary": "text", "profile.facts": "facts", "profile.projects": "projects" },
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
    return record("surface", id, String(base.owner_user_id), memberIds.filter((user) => user !== base.owner_user_id), {
      kind: "room", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: base.governance_version,
      allowedModules: ["room.introduction", "room.chat"],
      authorizedBindings: ["room.themeTopic", "room.connectionContext", "room.memberPublicProfiles", "room.messageSummaries"],
      trustedComponents: [...designPolicy.trustedComponents],
      governance: { mode: "unanimous_members", memberUserIds: memberIds, requiredApproverIds: memberIds, requiredApprovals: memberIds.length, governanceVersion: base.governance_version },
    } as T, Number(base.governance_version), new Date(Number(base.updated_at)).toISOString());
  }

  const circle = await first(DB, "SELECT c.governance_mode,c.governance_version FROM circles c JOIN circle_memberships current ON current.circle_id=c.id AND current.user_id=? AND current.status='active' JOIN users u ON u.id=current.user_id AND u.status='active' WHERE c.id=? AND c.status='active'", actor, base.subject_id);
  if (!circle) return null;
  const members = await all(DB, "SELECT cm.user_id,cm.role FROM circle_memberships cm JOIN users u ON u.id=cm.user_id AND u.status='active' WHERE cm.circle_id=? AND cm.status='active' ORDER BY cm.user_id", base.subject_id);
  const memberIds = members.map((member) => String(member.user_id)).filter(Boolean);
  if (memberIds.length === 0 || !memberIds.includes(actor)) return null;
  const modules = await all(DB, "SELECT kind FROM circle_modules WHERE circle_id=? AND active=1 ORDER BY kind LIMIT 20", base.subject_id);
  const common = {
    kind: "circle", subjectId: base.subject_id, publishedRevisionId: base.published_revision_id, governanceVersion: circle.governance_version,
    allowedModules: ["circle.identity", "circle.members", ...modules.map((module) => `circle.${String(module.kind)}`)],
    authorizedBindings: ["circle.name", "circle.purpose", "circle.members", "circle.modules", "circle.metrics"],
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
function profileValue(row: Row) { return { profileId: row.id, surfaceId: `surface_profile_${row.id}`, handle: row.handle, displayName: row.display_name, builderSummary: row.summary, projectOrInterest: row.project_or_interest, portfolioLinks: JSON.parse(String(row.portfolio_links_json ?? "[]")), audience: row.audience, allowMatching: Boolean(row.allow_matching), acceptanceMode: row.acceptance_mode, coarseLocation: row.coarse_location ?? undefined, locationMapOptIn: Boolean(row.location_map_opt_in), timezone: row.timezone ?? undefined, publishedAt: row.published_at ? new Date(Number(row.published_at)).toISOString() : null }; }
function inviteValue(row: Row) { return { inviteId: row.id, kind: row.kind, headline: row.headline, targetId: row.target_id, maximumUses: row.maximum_uses, uses: row.use_count, expiresAt: new Date(Number(row.expires_at)).toISOString(), status: row.revoked_at ? "revoked" : "active" }; }

async function assertInviteTarget(DB:Database,actor:string,kind:string,targetId:string|null){if(kind==="personal"){if(targetId)throw new Error("invalid_invite_target");return}if(!targetId)throw new Error("invalid_invite_target");const row=kind==="builder"?await first(DB,"SELECT 1 AS ok FROM profiles WHERE id=? AND user_id=?",targetId,actor):kind==="connection_card"?await first(DB,"SELECT 1 AS ok FROM projects WHERE id=? AND owner_user_id=? AND status<>'deleted'",targetId,actor):null;if(!row)throw new Error("object_not_found_or_not_authorized")}
async function assertFollowWatchTarget(DB:Database,actor:string,relation:string,targetKind:string,targetId:string){if(relation==="watch"){if(targetKind!=="relevant_builder"||targetId!=="network")throw new Error("invalid_follow_watch_target");return}if(relation!=="follow")throw new Error("invalid_follow_watch_target");let row:Row|null=null;if(targetKind==="profile")row=await visibleProfileTarget(DB,actor,targetId);else if(targetKind==="project")row=await first(DB,"SELECT 1 AS ok FROM projects x JOIN profiles p ON p.user_id=x.owner_user_id JOIN users u ON u.id=x.owner_user_id WHERE x.id=? AND x.owner_user_id<>? AND u.status='active' AND p.published_at IS NOT NULL AND x.status='active' AND x.published_at IS NOT NULL AND x.audience IN ('public','signed_in') AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=x.owner_user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=x.owner_user_id)))",targetId,actor,actor,actor);else if(targetKind==="topic")row=await first(DB,"SELECT 1 AS ok FROM topics t JOIN taxonomy_versions v ON v.id=t.taxonomy_version_id WHERE t.id=? AND v.status='active'",targetId);if(!row)throw new Error("object_not_found_or_not_authorized")}
async function visibleProfileTarget(DB:Database,actor:string,targetId:string){return first(DB,"SELECT 1 AS ok FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.user_id<>? AND u.status='active' AND p.published_at IS NOT NULL AND p.audience IN ('public','signed_in') AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=p.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=p.user_id)))",targetId,actor,actor,actor)}
function candidateBatchValue(row: Row) { return { batchId: row.id, indexVersion: row.index_version, taxonomyVersion: row.taxonomy_version, candidateIds: JSON.parse(String(row.candidate_ids_json ?? "[]")), expiresAt: new Date(Number(row.expires_at)).toISOString() }; }
function connectionNoteValue(row: Row) { return { connectionId: row.connection_id, body: row.body, createdAt: new Date(Number(row.created_at)).toISOString(), updatedAt: new Date(Number(row.updated_at)).toISOString() }; }
function connectionReminderValue(row: Row) { return { connectionId: row.connection_id, remindAt: new Date(Number(row.remind_at)).toISOString(), status: row.status }; }
function roomValue(row: Row) { return { roomId: row.id, status: row.status, themeTopicId: row.theme_topic_id ?? null }; }
function circleValue(row: Row) { return { circleId: row.id, surfaceId: row.surface_id ?? null, name: row.name, purpose: row.purpose, status: row.status, governanceMode: row.governance_mode, governanceVersion: row.governance_version }; }
function calendarValue(row: Row) { return { roomId: row.room_id, meetingProposalId: row.meeting_proposal_id, provider: row.provider, providerEventId: row.provider_event_id, startsAt: new Date(Number(row.starts_at)).toISOString(), endsAt: new Date(Number(row.ends_at)).toISOString(), participantLabels: JSON.parse(String(row.participant_labels_json)), status: row.status }; }
function automationValue(row: Row) { const state = JSON.parse(String(row.state_json)); return { ...state, kind: row.kind, cursor: row.cursor, state: state.state, lastOutcome: state.lastOutcome, enabled: state.enabled ?? state.state !== "disabled", cadence: state.cadence ?? null, sourceLivenessReviewed: state.sourceLivenessReviewed ?? false, nextRunAt: row.next_run_at ? new Date(Number(row.next_run_at)).toISOString() : null }; }
