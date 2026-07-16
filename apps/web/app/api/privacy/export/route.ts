import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { consumeWebRateLimit } from "@/src/security/rate-limit";

export async function GET() {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  try {
    await consumeWebRateLimit(DB, "account_export", user.id, 3, 24 * 60 * 60 * 1000);
    const profile = await DB.prepare("SELECT id,display_name AS displayName,summary,project_or_interest AS projectOrInterest,portfolio_links_json AS portfolioLinks,audience,allow_matching AS allowMatching,acceptance_mode AS acceptanceMode,indexable,coarse_location AS coarseLocation,location_map_opt_in AS locationMapOptIn,timezone,published_at AS publishedAt,created_at AS createdAt,updated_at AS updatedAt FROM profiles WHERE user_id=?").bind(user.id).first();
    const profileId = (profile as { id?: string } | null)?.id ?? "";
    const rows = await Promise.all([
      DB.prepare("SELECT handle,created_at AS createdAt FROM handles WHERE user_id=?").bind(user.id).first(),
      DB.prepare("SELECT field_key AS fieldKey,value_json AS value,audience,allow_matching AS allowMatching,source_status AS sourceStatus,provenance,updated_at AS updatedAt FROM profile_fields WHERE profile_id=? ORDER BY field_key").bind(profileId).all(),
      DB.prepare("SELECT stat_key AS statKey,label,value,provenance,audience,updated_at AS updatedAt FROM profile_statistics WHERE profile_id=? ORDER BY stat_key").bind(profileId).all(),
      DB.prepare("SELECT id,app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt,revoked_at AS revokedAt FROM connected_app_preferences WHERE user_id=? ORDER BY last_reviewed_at DESC").bind(user.id).all(),
      DB.prepare("SELECT id,source_app_id AS sourceAppId,free_text_summary AS summary,canonical_topic_ids_json AS topicIds,canonical_tool_ids_json AS toolIds,canonical_domain_ids_json AS domainIds,canonical_stage_ids_json AS stageIds,canonical_collaboration_intent_ids_json AS collaborationIntentIds,audience,allow_matching AS allowMatching,starts_at AS startsAt,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt,updated_at AS updatedAt FROM work_signals WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,slug,title,summary,audience,allow_matching AS allowMatching,status,stage,indexable,published_at AS publishedAt,deleted_at AS deletedAt,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE owner_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,intent_summary AS intentSummary,similar_adjacent AS similarAdjacent,local_global AS localGlobal,serendipity,collaboration_intent_ids_json AS collaborationIntentIds,controls_json AS controls,starts_at AS startsAt,expires_at AS expiresAt,created_at AS createdAt FROM networking_pulses WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,muted,renewed_relevance_enabled AS renewedRelevanceEnabled,renewed_relevance_acknowledged_at AS renewedRelevanceAcknowledgedAt,created_at AS createdAt,updated_at AS updatedAt FROM connection_sides WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,body,created_at AS createdAt,updated_at AS updatedAt FROM connection_private_notes WHERE owner_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT room_id AS roomId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM messages WHERE sender_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT circle_id AS circleId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM circle_messages WHERE sender_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT target_kind AS targetKind,target_id AS targetId,reason_code AS reasonCode,details,status,created_at AS createdAt,updated_at AS updatedAt FROM reports WHERE reporter_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT action,object_kind AS objectKind,object_id AS objectId,created_at AS createdAt FROM audit_events WHERE actor_user_id=? ORDER BY created_at").bind(user.id).all(),
    ]);
    const [handle, fields, statistics, sources, signals, projects, pulses, connections, privateNotes, roomMessages, circleMessages, reports, audit] = rows;
    const payload = {
      schema: "buildmates-account-export/v1",
      generatedAt: new Date().toISOString(),
      account: { userId: user.id, handle, profile },
      profileFields: fields.results,
      profileStatistics: statistics.results,
      sourcePolicies: sources.results,
      workSignals: signals.results,
      projects: projects.results,
      networkingPulses: pulses.results,
      connections: connections.results,
      privateConnectionNotes: privateNotes.results,
      authoredRoomMessages: roomMessages.results,
      authoredCircleMessages: circleMessages.results,
      reports: reports.results,
      audit: audit.results,
    };
    await DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,'{}',?)")
      .bind(`audit_${crypto.randomUUID()}`, user.id, "export.downloaded", "user", user.id, Date.now()).run();
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="buildmates-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const rateLimited = error instanceof Error && error.message === "rate_limited";
    return Response.json({ error: rateLimited ? "rate_limited" : "export_failed" }, { status: rateLimited ? 429 : 500 });
  }
}
