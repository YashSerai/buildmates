import { safeParseModuleAppearance, type ModuleAppearance } from "@buildmates/surfaces";

const MODULE_KINDS = ["resource_shelf", "experiment_tracker", "decision_log", "feedback_queue", "milestone_tracker"] as const;
export type RoomModuleKind = (typeof MODULE_KINDS)[number];
export type RoomModuleEntry = {id:string;moduleId:string;authorUserId:string;authorName:string;payload:Record<string,string>;createdAt:number;updatedAt:number};
function parseJson<T>(value:unknown,fallback:T):T{if(typeof value!=="string")return fallback;try{return JSON.parse(value) as T}catch{return fallback}}

type ConnectionContext = {
  connectionId: string;
  roomId: string;
  state: "active" | "ended" | "blocked";
  roomStatus: "active" | "ended" | "deleted";
  otherUserId: string;
};

async function connectionContext(DB: D1Database, connectionId: string, userId: string): Promise<ConnectionContext> {
  const row = await DB.prepare(`SELECT c.id AS connectionId,r.id AS roomId,c.state,r.status AS roomStatus,
    CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AS otherUserId
    FROM connections c
    JOIN connection_sides side ON side.connection_id=c.id AND side.user_id=?
    JOIN users viewer ON viewer.id=? AND viewer.status='active'
    JOIN match_pairs pair ON pair.id=c.match_pair_id
    JOIN rooms r ON r.connection_id=c.id
    WHERE c.id=? LIMIT 1`).bind(userId, userId, userId, connectionId).first<ConnectionContext>();
  if (!row) throw new Error("connection_not_found");
  const blocked = await DB.prepare(`SELECT 1 AS blocked FROM blocks WHERE revoked_at IS NULL AND
    ((blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)) LIMIT 1`)
    .bind(userId, row.otherUserId, row.otherUserId, userId).first();
  if (blocked || row.state === "blocked") throw new Error("connection_not_found");
  return row;
}

export async function getConnectionDetail(DB: D1Database, connectionId: string, userId: string) {
  const context = await connectionContext(DB, connectionId, userId);
  const detail = await DB.prepare(`SELECT COALESCE(snapshot.display_name,'Buildmate') AS otherName,COALESCE(snapshot.summary,'Connected through mutual work') AS otherSummary,
    side.muted,side.renewed_relevance_enabled AS renewedRelevanceEnabled,side.renewed_relevance_acknowledged_at AS renewedRelevanceAcknowledgedAt,
    COALESCE(subscription.enabled,1) AS updatesEnabled,note.body AS privateNote
    FROM connection_sides side
    LEFT JOIN connection_snapshots snapshot ON snapshot.connection_id=side.connection_id AND snapshot.subject_user_id=?
    LEFT JOIN connection_update_subscriptions subscription ON subscription.connection_id=side.connection_id AND subscription.subscriber_user_id=side.user_id
    LEFT JOIN connection_private_notes note ON note.connection_id=side.connection_id AND note.owner_user_id=side.user_id
    WHERE side.connection_id=? AND side.user_id=? LIMIT 1`).bind(context.otherUserId, connectionId, userId).first<{
      otherName: string; otherSummary: string; muted: number; renewedRelevanceEnabled: number;
      renewedRelevanceAcknowledgedAt: number | null; updatesEnabled: number; privateNote: string | null;
    }>();
  if (!detail) throw new Error("connection_not_found");
  const reminders = await DB.prepare(`SELECT id,remind_at AS remindAt,status FROM connection_reminders
    WHERE connection_id=? AND user_id=? AND status='scheduled' ORDER BY remind_at ASC LIMIT 20`)
    .bind(connectionId, userId).all<{id:string;remindAt:number;status:string}>();
  const reconnect = await DB.prepare(`SELECT id,requester_user_id AS requesterUserId,response,created_at AS createdAt
    FROM reconnect_requests WHERE connection_id=? AND response='pending' ORDER BY created_at DESC LIMIT 1`)
    .bind(connectionId).first<{id:string;requesterUserId:string;response:string;createdAt:number}>();
  const [meetingRows,circleRows,updateRows,matchContext]=await Promise.all([
    DB.prepare("SELECT id,starts_at AS startsAt,ends_at AS endsAt,timezone,status FROM meeting_proposals WHERE room_id=? AND status IN ('proposed','accepted','countered') ORDER BY created_at DESC LIMIT 20").bind(context.roomId).all(),
    DB.prepare(`SELECT c.id,c.name FROM circles c JOIN circle_memberships mine ON mine.circle_id=c.id AND mine.user_id=? AND mine.status='active'
      JOIN circle_memberships theirs ON theirs.circle_id=c.id AND theirs.user_id=? AND theirs.status='active' WHERE c.status='active' ORDER BY c.updated_at DESC LIMIT 20`).bind(userId,context.otherUserId).all(),
    detail.updatesEnabled?DB.prepare(`SELECT update_row.id,project.slug,project.title,update_row.body,update_row.created_at AS createdAt
      FROM project_updates update_row JOIN projects project ON project.id=update_row.project_id
      WHERE project.owner_user_id=? AND project.status='active' AND project.audience='public' AND project.published_at IS NOT NULL AND project.deleted_at IS NULL AND update_row.audience='public'
      ORDER BY update_row.created_at DESC LIMIT 20`).bind(context.otherUserId).all():Promise.resolve({results:[]}),
    DB.prepare("SELECT reason,shared_context_json AS sharedContextJson,theme_topic_id AS themeTopicId FROM connection_context_snapshots WHERE connection_id=?").bind(connectionId).first<{reason:string;sharedContextJson:string;themeTopicId:string|null}>(),
  ]);
  return {...context, ...detail, muted:Boolean(detail.muted), renewedRelevanceEnabled:Boolean(detail.renewedRelevanceEnabled), updatesEnabled:Boolean(detail.updatesEnabled), reminders:reminders.results, reconnect,meetings:meetingRows.results,circles:circleRows.results,publicUpdates:updateRows.results,matchContext:matchContext?{reason:matchContext.reason,sharedContext:parseJson<string[]>(matchContext.sharedContextJson,[]),themeTopicId:matchContext.themeTopicId}:null};
}

export async function materializeRelationshipNotifications(DB:D1Database,userId:string,now:number){
  const due=await DB.prepare(`SELECT reminder.id,reminder.connection_id AS connectionId FROM connection_reminders reminder
    JOIN connection_sides side ON side.connection_id=reminder.connection_id AND side.user_id=reminder.user_id AND side.muted=0
    JOIN connections connection_row ON connection_row.id=reminder.connection_id AND connection_row.state<>'blocked'
    WHERE reminder.user_id=? AND reminder.status='scheduled' AND reminder.remind_at<=? ORDER BY reminder.remind_at LIMIT 50`).bind(userId,now).all<{id:string;connectionId:string}>();
  const statements:D1PreparedStatement[]=[];
  for(const reminder of due.results){
    statements.push(DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'connection_reminder','immediate',?,? WHERE EXISTS (SELECT 1 FROM connection_reminders WHERE id=? AND user_id=? AND status='scheduled')").bind(`connection-reminder:${reminder.id}`,userId,JSON.stringify({connectionId:reminder.connectionId,reminderId:reminder.id}),now,reminder.id,userId));
    statements.push(DB.prepare("UPDATE connection_reminders SET status='sent' WHERE id=? AND user_id=? AND status='scheduled'").bind(reminder.id,userId));
  }
  const relevant=await DB.prepare(`SELECT side.connection_id AS connectionId,project_update.id AS updateId,project.id AS projectId,project.title AS projectTitle
    FROM connection_sides side JOIN connections connection_row ON connection_row.id=side.connection_id AND connection_row.state='active'
    JOIN match_pairs pair ON pair.id=connection_row.match_pair_id
    JOIN projects project ON project.owner_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END
    JOIN project_updates project_update ON project_update.project_id=project.id
    WHERE side.user_id=? AND side.muted=0 AND side.renewed_relevance_enabled=1 AND project.status='active' AND project.audience='public' AND project.published_at IS NOT NULL AND project.deleted_at IS NULL AND project_update.audience='public'
      AND project_update.created_at>COALESCE(side.renewed_relevance_acknowledged_at,side.created_at)
      AND NOT EXISTS (SELECT 1 FROM blocks block WHERE block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=project.owner_user_id) OR (block.blocker_user_id=project.owner_user_id AND block.blocked_user_id=?)))
    ORDER BY project_update.created_at DESC LIMIT 50`).bind(userId,userId,userId,userId).all<{connectionId:string;updateId:string;projectId:string;projectTitle:string}>();
  for(const item of relevant.results)statements.push(DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,'renewed_relevance','immediate',?,?)").bind(`renewed-relevance:${item.connectionId}:${item.updateId}:${userId}`,userId,JSON.stringify({connectionId:item.connectionId,projectId:item.projectId,projectTitle:item.projectTitle,updateId:item.updateId}),now));
  if(statements.length)await DB.batch(statements);
}

export async function updateConnectionPreference(DB:D1Database,input:{connectionId:string;userId:string;kind:"muted"|"renewed_relevance"|"updates";enabled:boolean;now:number}) {
  const context=await connectionContext(DB,input.connectionId,input.userId);
  if(input.kind==="muted") await DB.prepare("UPDATE connection_sides SET muted=?,updated_at=? WHERE connection_id=? AND user_id=?").bind(input.enabled?1:0,input.now,input.connectionId,input.userId).run();
  else if(input.kind==="renewed_relevance") await DB.prepare("UPDATE connection_sides SET renewed_relevance_enabled=?,updated_at=? WHERE connection_id=? AND user_id=?").bind(input.enabled?1:0,input.now,input.connectionId,input.userId).run();
  else await DB.prepare(`INSERT INTO connection_update_subscriptions (connection_id,subscriber_user_id,subject_user_id,enabled,created_at,updated_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(connection_id,subscriber_user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`)
    .bind(input.connectionId,input.userId,context.otherUserId,input.enabled?1:0,input.now,input.now).run();
}

export async function savePrivateNote(DB:D1Database,input:{connectionId:string;userId:string;body:string;now:number}) {
  await connectionContext(DB,input.connectionId,input.userId);
  const id=`note:${input.connectionId}:${input.userId}`;
  if(!input.body.trim()) await DB.prepare("DELETE FROM connection_private_notes WHERE connection_id=? AND owner_user_id=?").bind(input.connectionId,input.userId).run();
  else await DB.prepare(`INSERT INTO connection_private_notes (id,connection_id,owner_user_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`).bind(id,input.connectionId,input.userId,input.body.trim(),input.now,input.now).run();
}

export async function createReminder(DB:D1Database,input:{connectionId:string;userId:string;remindAt:number;now:number}) {
  await connectionContext(DB,input.connectionId,input.userId);
  if(input.remindAt<=input.now)throw new Error("reminder_must_be_future");
  const id=crypto.randomUUID();
  await DB.prepare("INSERT INTO connection_reminders (id,connection_id,user_id,remind_at,status,created_at) VALUES (?,?,?,?,'scheduled',?)").bind(id,input.connectionId,input.userId,input.remindAt,input.now).run();
  return {id};
}

export async function dismissReminder(DB:D1Database,input:{connectionId:string;userId:string;reminderId:string}) {
  await connectionContext(DB,input.connectionId,input.userId);
  const result=await DB.prepare("UPDATE connection_reminders SET status='dismissed' WHERE id=? AND connection_id=? AND user_id=? AND status='scheduled'").bind(input.reminderId,input.connectionId,input.userId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("reminder_not_found");
}

export async function endConnection(DB:D1Database,input:{connectionId:string;userId:string;now:number}) {
  const context=await connectionContext(DB,input.connectionId,input.userId);
  if(context.state==="ended")return;
  await DB.batch([
    DB.prepare("UPDATE connections SET state='ended',ended_by_user_id=?,ended_at=?,updated_at=? WHERE id=? AND state='active'").bind(input.userId,input.now,input.now,input.connectionId),
    DB.prepare("UPDATE rooms SET status='ended',updated_at=? WHERE connection_id=? AND status='active'").bind(input.now,input.connectionId),
  ]);
}

export async function requestReconnect(DB:D1Database,input:{connectionId:string;userId:string;now:number}) {
  const context=await connectionContext(DB,input.connectionId,input.userId);
  if(context.state!=="ended")throw new Error("connection_not_ended");
  const existing=await DB.prepare("SELECT id FROM reconnect_requests WHERE connection_id=? AND requester_user_id=? AND response='pending' LIMIT 1").bind(input.connectionId,input.userId).first<{id:string}>();
  if(existing)return existing;
  const id=await stableLifecycleId("reconnect",input.connectionId,input.userId);
  await DB.batch([
    DB.prepare("INSERT OR IGNORE INTO reconnect_requests (id,connection_id,requester_user_id,response,created_at) VALUES (?,?,?,'pending',?)").bind(id,input.connectionId,input.userId,input.now),
    DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'reconnect_requested','immediate',?,? WHERE EXISTS (SELECT 1 FROM reconnect_requests WHERE id=? AND connection_id=? AND requester_user_id=? AND response='pending') AND EXISTS (SELECT 1 FROM connection_sides WHERE connection_id=? AND user_id=? AND muted=0)").bind(`reconnect-requested:${id}`,context.otherUserId,JSON.stringify({connectionId:input.connectionId,requestId:id}),input.now,id,input.connectionId,input.userId,input.connectionId,context.otherUserId),
  ]);
  const pending=await DB.prepare("SELECT id,requester_user_id AS requesterUserId FROM reconnect_requests WHERE connection_id=? AND response='pending' LIMIT 1").bind(input.connectionId).first<{id:string;requesterUserId:string}>();
  if(!pending)throw new Error("reconnect_conflict");
  return pending;
}

export async function respondReconnect(DB:D1Database,input:{connectionId:string;userId:string;requestId:string;response:"accepted"|"declined";now:number}) {
  const context=await connectionContext(DB,input.connectionId,input.userId);
  const request=await DB.prepare("SELECT requester_user_id AS requesterUserId FROM reconnect_requests WHERE id=? AND connection_id=? AND response='pending' LIMIT 1").bind(input.requestId,input.connectionId).first<{requesterUserId:string}>();
  if(!request||request.requesterUserId===input.userId)throw new Error("reconnect_not_found");
  // The response and the account-status check must be one compare-and-set.
  // Account deletion can revoke a participant between the initial read and
  // this write; an old pending request must never revive the relationship.
  const statements=[DB.prepare("UPDATE reconnect_requests SET response=?,responded_at=? WHERE id=? AND connection_id=? AND requester_user_id<>? AND response='pending' AND EXISTS (SELECT 1 FROM connections active_connection JOIN match_pairs active_pair ON active_pair.id=active_connection.match_pair_id JOIN users active_a ON active_a.id=active_pair.user_a_id AND active_a.status='active' JOIN users active_b ON active_b.id=active_pair.user_b_id AND active_b.status='active' WHERE active_connection.id=? AND active_connection.id=reconnect_requests.connection_id)").bind(input.response,input.now,input.requestId,input.connectionId,input.userId,input.connectionId)];
  if(input.response==="accepted")statements.push(
    DB.prepare("UPDATE connections SET state='active',ended_by_user_id=NULL,ended_at=NULL,updated_at=? WHERE id=? AND state='ended' AND EXISTS (SELECT 1 FROM reconnect_requests WHERE id=? AND connection_id=? AND response='accepted' AND responded_at=?) AND EXISTS (SELECT 1 FROM match_pairs active_pair JOIN users active_a ON active_a.id=active_pair.user_a_id AND active_a.status='active' JOIN users active_b ON active_b.id=active_pair.user_b_id AND active_b.status='active' WHERE active_pair.id=connections.match_pair_id)").bind(input.now,input.connectionId,input.requestId,input.connectionId,input.now),
    DB.prepare("UPDATE rooms SET status='active',updated_at=? WHERE id=? AND status='ended' AND EXISTS (SELECT 1 FROM reconnect_requests WHERE id=? AND connection_id=? AND response='accepted' AND responded_at=?) AND EXISTS (SELECT 1 FROM connections active_connection JOIN match_pairs active_pair ON active_pair.id=active_connection.match_pair_id JOIN users active_a ON active_a.id=active_pair.user_a_id AND active_a.status='active' JOIN users active_b ON active_b.id=active_pair.user_b_id AND active_b.status='active' WHERE active_connection.id=? AND active_connection.id=rooms.connection_id)").bind(input.now,context.roomId,input.requestId,input.connectionId,input.now,input.connectionId),
  );
  const results=await DB.batch(statements);
  if(!Number(results[0]?.meta.changes??0))throw new Error("reconnect_not_found");
  const won=await DB.prepare("SELECT response,responded_at AS respondedAt FROM reconnect_requests WHERE id=? AND connection_id=?").bind(input.requestId,input.connectionId).first<{response:string;respondedAt:number|null}>();
  if(!won||won.response!==input.response||won.respondedAt!==input.now)throw new Error("reconnect_not_found");
}

export async function acknowledgeRenewedRelevance(DB:D1Database,input:{connectionId:string;userId:string;now:number}) {
  await connectionContext(DB,input.connectionId,input.userId);
  const result=await DB.prepare("UPDATE connection_sides SET renewed_relevance_acknowledged_at=?,updated_at=? WHERE connection_id=? AND user_id=? AND renewed_relevance_enabled=1").bind(input.now,input.now,input.connectionId,input.userId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("connection_not_found");
}

export async function saveIntroductionFeedback(DB:D1Database,input:{connectionId:string;userId:string;useful:boolean;reasons:string[];similarMatchPreference:"more"|"same"|"less"|null;followUpIntent:"keep_connected"|"collaborate"|"not_now"|null;privateNote:string|null;now:number}) {
  await connectionContext(DB,input.connectionId,input.userId);
  await DB.prepare(`INSERT INTO introduction_feedback (id,connection_id,user_id,useful,reasons_json,similar_match_preference,follow_up_intent,private_note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET useful=excluded.useful,reasons_json=excluded.reasons_json,similar_match_preference=excluded.similar_match_preference,follow_up_intent=excluded.follow_up_intent,private_note=excluded.private_note`)
    .bind(crypto.randomUUID(),input.connectionId,input.userId,input.useful?1:0,JSON.stringify(input.reasons),input.similarMatchPreference,input.followUpIntent,input.privateNote,input.now).run();
}

async function roomContext(DB:D1Database,roomId:string,userId:string){
  const row=await DB.prepare("SELECT connection_id AS connectionId FROM rooms WHERE id=? LIMIT 1").bind(roomId).first<{connectionId:string}>();
  if(!row)throw new Error("room_not_found");
  const context=await connectionContext(DB,row.connectionId,userId);
  if(context.roomId!==roomId||context.state!=="active"||context.roomStatus!=="active")throw new Error("room_not_found");
  return context;
}

export async function listRoomEnhancements(DB:D1Database,roomId:string,userId:string){
  const context=await roomContext(DB,roomId,userId);
  const [upgrades,modules,entries,meetings,receipts,myAvailability,intersections,feedback]=await Promise.all([
    DB.prepare(`SELECT p.id,p.proposer_user_id AS proposerUserId,p.modules_json AS modulesJson,p.explanation,p.status,p.created_at AS createdAt,
      SUM(CASE WHEN r.response='accepted' THEN 1 ELSE 0 END) AS acceptCount
      FROM room_upgrade_proposals p LEFT JOIN room_upgrade_responses r ON r.proposal_id=p.id WHERE p.room_id=? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 20`).bind(roomId).all(),
    DB.prepare("SELECT id,kind,config_json AS configJson,active,created_at AS createdAt FROM room_modules WHERE room_id=? AND active=1 ORDER BY created_at").bind(roomId).all(),
    DB.prepare(`SELECT entry.id,entry.module_id AS moduleId,entry.author_user_id AS authorUserId,profile.display_name AS authorName,
      entry.payload_json AS payloadJson,entry.created_at AS createdAt,entry.updated_at AS updatedAt
      FROM room_module_entries entry JOIN room_modules module ON module.id=entry.module_id AND module.room_id=? AND module.active=1
      JOIN profiles profile ON profile.user_id=entry.author_user_id WHERE entry.deleted_at IS NULL ORDER BY entry.created_at DESC LIMIT 200`).bind(roomId).all(),
    DB.prepare("SELECT id,proposer_user_id AS proposerUserId,parent_proposal_id AS parentProposalId,starts_at AS startsAt,ends_at AS endsAt,timezone,note,status,created_at AS createdAt FROM meeting_proposals WHERE room_id=? ORDER BY created_at DESC LIMIT 20").bind(roomId).all(),
    DB.prepare("SELECT id,provider,provider_event_id AS providerEventId,starts_at AS startsAt,ends_at AS endsAt,status,created_at AS createdAt FROM calendar_event_receipts WHERE room_id=? ORDER BY created_at DESC LIMIT 20").bind(roomId).all(),
    DB.prepare("SELECT id,starts_at AS startsAt,ends_at AS endsAt,timezone,status FROM availability_windows WHERE room_id=? AND user_id=? AND status='approved' ORDER BY starts_at LIMIT 20").bind(roomId,userId).all(),
    DB.prepare(`SELECT MAX(mine.starts_at,theirs.starts_at) AS startsAt,MIN(mine.ends_at,theirs.ends_at) AS endsAt,mine.timezone AS myTimezone,theirs.timezone AS theirTimezone
      FROM availability_windows mine JOIN availability_windows theirs ON theirs.room_id=mine.room_id AND theirs.user_id=? AND theirs.status='approved'
      WHERE mine.room_id=? AND mine.user_id=? AND mine.status='approved' AND MAX(mine.starts_at,theirs.starts_at)<MIN(mine.ends_at,theirs.ends_at)
      ORDER BY startsAt LIMIT 20`).bind(context.otherUserId,roomId,userId).all(),
    DB.prepare("SELECT useful,created_at AS createdAt FROM introduction_feedback WHERE connection_id=? AND user_id=? LIMIT 1").bind(context.connectionId,userId).first<{useful:number;createdAt:number}>(),
  ]);
  return {viewerUserId:userId,feedback:{submitted:Boolean(feedback),useful:feedback?Boolean(feedback.useful):null,createdAt:feedback?.createdAt??null},upgradeEligible:Boolean(feedback?.useful),upgrades:upgrades.results.map((r)=>({...r,modules:parseProposedRoomModules(r.modulesJson).map((module)=>module.kind),acceptCount:Number(r.acceptCount),mine:String(r.proposerUserId)===userId})),modules:modules.results.map((r)=>({...r,active:Boolean(r.active),config:parseJson<Record<string,unknown>>(r.configJson,{})})),entries:entries.results.map((r)=>({...r,payload:parseJson<Record<string,string>>(r.payloadJson,{})})),meetings:meetings.results.map((r)=>({...r,mine:String(r.proposerUserId)===userId})),receipts:receipts.results,myAvailability:myAvailability.results,availabilityIntersections:intersections.results};
}

export async function addRoomModuleEntry(DB:D1Database,input:{roomId:string;userId:string;moduleId:string;payload:Record<string,unknown>;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  const moduleRow=await DB.prepare("SELECT kind FROM room_modules WHERE id=? AND room_id=? AND active=1").bind(input.moduleId,input.roomId).first<{kind:string}>();
  if(!moduleRow)throw new Error("module_not_found");
  const payload=validateRoomModuleEntry(moduleRow.kind,input.payload);
  const id=crypto.randomUUID();
  await DB.prepare("INSERT INTO room_module_entries (id,module_id,author_user_id,payload_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)").bind(id,input.moduleId,input.userId,JSON.stringify(payload),input.now,input.now).run();
  return{id};
}

export async function updateRoomModuleEntry(DB:D1Database,input:{roomId:string;userId:string;moduleId:string;entryId:string;payload:Record<string,unknown>;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  const moduleRow=await DB.prepare("SELECT kind FROM room_modules WHERE id=? AND room_id=? AND active=1").bind(input.moduleId,input.roomId).first<{kind:string}>();
  if(!moduleRow)throw new Error("module_not_found");
  const payload=validateRoomModuleEntry(moduleRow.kind,input.payload);
  const result=await DB.prepare("UPDATE room_module_entries SET payload_json=?,updated_at=? WHERE id=? AND module_id=? AND author_user_id=? AND deleted_at IS NULL").bind(JSON.stringify(payload),input.now,input.entryId,input.moduleId,input.userId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("entry_not_found");
}

export async function deleteRoomModuleEntry(DB:D1Database,input:{roomId:string;userId:string;moduleId:string;entryId:string;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  const result=await DB.prepare(`UPDATE room_module_entries SET payload_json='{}',updated_at=?,deleted_at=? WHERE id=? AND module_id=? AND author_user_id=? AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM room_modules module WHERE module.id=room_module_entries.module_id AND module.room_id=? AND module.active=1)`).bind(input.now,input.now,input.entryId,input.moduleId,input.userId,input.roomId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("entry_not_found");
}

export async function saveAvailabilityWindow(DB:D1Database,input:{roomId:string;userId:string;clientWindowId:string;startsAt:number;endsAt:number;timezone:string;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  if(input.startsAt<=input.now||input.endsAt<=input.startsAt)throw new Error("invalid_availability_window");
  const id=`availability:${input.userId}:${input.clientWindowId}`;
  await DB.prepare(`INSERT INTO availability_windows (id,room_id,user_id,starts_at,ends_at,timezone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'approved',?,?)
    ON CONFLICT(id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,status='approved',updated_at=excluded.updated_at
    WHERE availability_windows.room_id=excluded.room_id AND availability_windows.user_id=excluded.user_id`).bind(id,input.roomId,input.userId,input.startsAt,input.endsAt,input.timezone,input.now,input.now).run();
  return {id};
}

export async function withdrawAvailabilityWindow(DB:D1Database,input:{roomId:string;userId:string;windowId:string;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  const result=await DB.prepare("UPDATE availability_windows SET status='withdrawn',updated_at=? WHERE id=? AND room_id=? AND user_id=? AND status='approved'").bind(input.now,input.windowId,input.roomId,input.userId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("availability_window_not_found");
}

export async function proposeRoomUpgrade(DB:D1Database,input:{roomId:string;userId:string;proposalId?:string;modules:RoomModuleKind[];explanation:string;title?:string;appearance?:ModuleAppearance;now:number}) {
  await roomContext(DB,input.roomId,input.userId);
  const positive=await DB.prepare("SELECT 1 AS positive FROM introduction_feedback f JOIN rooms r ON r.connection_id=f.connection_id WHERE r.id=? AND f.user_id=? AND f.useful=1 LIMIT 1").bind(input.roomId,input.userId).first();
  if(!positive)throw new Error("positive_feedback_required");
  const modules=[...new Set(input.modules)].filter((kind):kind is RoomModuleKind=>MODULE_KINDS.includes(kind as RoomModuleKind));
  if(!modules.length)throw new Error("modules_required");
  if(input.appearance&&!safeParseModuleAppearance(input.appearance).success)throw new Error("module_appearance_invalid");
  const title=input.title?.trim();
  if(title&&title.length>120)throw new Error("module_title_invalid");
  const proposedModules=modules.map((kind)=>({kind,config:{...(title?{title}:{}),...(input.appearance?{appearance:input.appearance}:{})}}));
  const id=input.proposalId??crypto.randomUUID();
  await DB.batch([
    DB.prepare("INSERT INTO room_upgrade_proposals (id,room_id,proposer_user_id,modules_json,explanation,status,created_at) VALUES (?,?,?,?,?,'proposed',?)").bind(id,input.roomId,input.userId,JSON.stringify(proposedModules),input.explanation,input.now),
    DB.prepare("INSERT INTO room_upgrade_responses (proposal_id,user_id,response,created_at) VALUES (?,?,'accepted',?)").bind(id,input.userId,input.now),
  ]);
  return {id,status:"proposed" as const};
}

export async function respondRoomUpgrade(DB:D1Database,input:{roomId:string;proposalId:string;userId:string;response:"accepted"|"declined";now:number}) {
  const context=await roomContext(DB,input.roomId,input.userId);
  const proposal=await DB.prepare("SELECT modules_json AS modulesJson,status FROM room_upgrade_proposals WHERE id=? AND room_id=? LIMIT 1").bind(input.proposalId,input.roomId).first<{modulesJson:string;status:string}>();
  if(proposal?.status==="activated"&&input.response==="accepted")return {id:input.proposalId,status:"activated" as const};
  if(!proposal||!['proposed','accepted'].includes(proposal.status))throw new Error("upgrade_not_found");
  const modules=parseProposedRoomModules(proposal.modulesJson);
  const statements: D1PreparedStatement[]=[DB.prepare(`INSERT INTO room_upgrade_responses (proposal_id,user_id,response,created_at)
    SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM room_upgrade_proposals WHERE id=? AND room_id=? AND status='proposed')
    ON CONFLICT(proposal_id,user_id) DO UPDATE SET response=excluded.response,created_at=excluded.created_at`).bind(input.proposalId,input.userId,input.response,input.now,input.proposalId,input.roomId)];
  if(input.response==="declined")statements.push(DB.prepare("UPDATE room_upgrade_proposals SET status='declined' WHERE id=? AND room_id=? AND status='proposed' AND EXISTS (SELECT 1 FROM room_upgrade_responses WHERE proposal_id=? AND user_id=? AND response='declined')").bind(input.proposalId,input.roomId,input.proposalId,input.userId));
  else {
    statements.push(DB.prepare(`UPDATE room_upgrade_proposals SET status='activated' WHERE id=? AND room_id=? AND status='proposed'
      AND NOT EXISTS (SELECT 1 FROM room_upgrade_responses WHERE proposal_id=? AND response='declined')
      AND 2=(SELECT COUNT(*) FROM room_upgrade_responses response JOIN room_memberships member ON member.room_id=? AND member.user_id=response.user_id AND member.left_at IS NULL WHERE response.proposal_id=? AND response.response='accepted')`).bind(input.proposalId,input.roomId,input.proposalId,input.roomId,input.proposalId));
    for(const roomModule of modules) statements.push(DB.prepare(`INSERT INTO room_modules (id,room_id,proposal_id,kind,config_json,active,created_at)
      SELECT ?,?,?,?,?,1,? FROM room_upgrade_proposals WHERE id=? AND room_id=? AND status='activated'
      ON CONFLICT(room_id,kind) DO UPDATE SET proposal_id=excluded.proposal_id,config_json=excluded.config_json,active=1,created_at=excluded.created_at`).bind(`module:${input.roomId}:${roomModule.kind}`,input.roomId,input.proposalId,roomModule.kind,JSON.stringify(roomModule.config),input.now,input.proposalId,input.roomId));
    statements.push(DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'room_upgraded','immediate',?,? WHERE EXISTS (SELECT 1 FROM room_upgrade_proposals WHERE id=? AND room_id=? AND status='activated') AND EXISTS (SELECT 1 FROM connection_sides WHERE connection_id=? AND user_id=? AND muted=0)").bind(`room-upgraded:${input.proposalId}:${context.otherUserId}`,context.otherUserId,JSON.stringify({roomId:input.roomId,proposalId:input.proposalId}),input.now,input.proposalId,input.roomId,context.connectionId,context.otherUserId));
  }
  await DB.batch(statements);
  const current=await DB.prepare("SELECT status FROM room_upgrade_proposals WHERE id=? AND room_id=?").bind(input.proposalId,input.roomId).first<{status:string}>();
  if(!current||(!['activated','declined','proposed'].includes(current.status)))throw new Error("upgrade_not_found");
  return {id:input.proposalId,status:current.status};
}

function parseProposedRoomModules(value:unknown):Array<{kind:RoomModuleKind;config:Record<string,unknown>}>{
  const parsed=parseJson<unknown[]>(value,[]);
  const result:Array<{kind:RoomModuleKind;config:Record<string,unknown>}>=[];
  for(const item of parsed){
    if(typeof item==="string"&&MODULE_KINDS.includes(item as RoomModuleKind)){result.push({kind:item as RoomModuleKind,config:{}});continue}
    if(!item||typeof item!=="object"||Array.isArray(item))continue;
    const candidate=item as Record<string,unknown>;
    if(!MODULE_KINDS.includes(candidate.kind as RoomModuleKind))continue;
    const config=candidate.config&&typeof candidate.config==="object"&&!Array.isArray(candidate.config)?candidate.config as Record<string,unknown>:{};
    if(config.appearance&&!safeParseModuleAppearance(config.appearance).success)continue;
    result.push({kind:candidate.kind as RoomModuleKind,config});
  }
  return result;
}

function validateRoomModuleEntry(kind:string,payload:Record<string,unknown>):Record<string,string>{
  const fields:Record<string,readonly string[]>={
    resource_shelf:["title","url","note"],
    experiment_tracker:["title","hypothesis","status","outcome"],
    decision_log:["decision","rationale"],
    feedback_queue:["feedback","status"],
    milestone_tracker:["milestone","dueDate","status"],
  };
  const allowed=fields[kind];
  if(!allowed)throw new Error("module_not_found");
  const normalized:Record<string,string>={};
  for(const key of allowed){const value=payload[key];if(typeof value==="string"&&value.trim())normalized[key]=value.trim().slice(0,2000)}
  const primary=allowed[0];
  if(!primary||!normalized[primary])throw new Error("entry_payload_invalid");
  if(kind==="resource_shelf"&&normalized.url&&!/^https?:\/\//i.test(normalized.url))throw new Error("entry_payload_invalid");
  return normalized;
}

export async function proposeMeeting(DB:D1Database,input:{roomId:string;userId:string;clientRequestId:string;startsAt:number;endsAt:number;timezone:string;note:string|null;parentProposalId?:string|null;now:number}){
  const context=await roomContext(DB,input.roomId,input.userId);
  if(input.startsAt<=input.now||input.endsAt<=input.startsAt)throw new Error("invalid_meeting_time");
  const id=await stableLifecycleId("meeting",input.roomId,input.userId,input.clientRequestId);
  const statements:D1PreparedStatement[]=[];
  if(input.parentProposalId){
    statements.push(DB.prepare(`INSERT OR IGNORE INTO meeting_proposals (id,room_id,proposer_user_id,parent_proposal_id,starts_at,ends_at,timezone,note,status,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,'proposed',?,? FROM meeting_proposals parent WHERE parent.id=? AND parent.room_id=? AND parent.status='proposed' AND parent.proposer_user_id<>?`).bind(id,input.roomId,input.userId,input.parentProposalId,input.startsAt,input.endsAt,input.timezone,input.note,input.now,input.now,input.parentProposalId,input.roomId,input.userId));
    statements.push(DB.prepare("UPDATE meeting_proposals SET status='countered',responded_by_user_id=?,responded_at=?,updated_at=? WHERE id=? AND room_id=? AND status='proposed' AND EXISTS (SELECT 1 FROM meeting_proposals child WHERE child.id=? AND child.parent_proposal_id=meeting_proposals.id)").bind(input.userId,input.now,input.now,input.parentProposalId,input.roomId,id));
  } else statements.push(DB.prepare("INSERT OR IGNORE INTO meeting_proposals (id,room_id,proposer_user_id,parent_proposal_id,starts_at,ends_at,timezone,note,status,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,?,'proposed',?,?)").bind(id,input.roomId,input.userId,input.startsAt,input.endsAt,input.timezone,input.note,input.now,input.now));
  statements.push(DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'meeting_proposed','immediate',?,? WHERE EXISTS (SELECT 1 FROM meeting_proposals WHERE id=? AND room_id=? AND status='proposed') AND EXISTS (SELECT 1 FROM connection_sides WHERE connection_id=? AND user_id=? AND muted=0)").bind(`meeting-proposed:${id}:${context.otherUserId}`,context.otherUserId,JSON.stringify({roomId:input.roomId,proposalId:id,startsAt:input.startsAt}),input.now,id,input.roomId,context.connectionId,context.otherUserId));
  await DB.batch(statements);
  const stored=await DB.prepare("SELECT starts_at AS startsAt,ends_at AS endsAt,timezone,note,parent_proposal_id AS parentProposalId FROM meeting_proposals WHERE id=? AND room_id=? AND proposer_user_id=?").bind(id,input.roomId,input.userId).first<{startsAt:number;endsAt:number;timezone:string;note:string|null;parentProposalId:string|null}>();
  if(!stored)throw new Error("meeting_not_found");
  if(stored.startsAt!==input.startsAt||stored.endsAt!==input.endsAt||stored.timezone!==input.timezone||stored.note!==input.note||stored.parentProposalId!==(input.parentProposalId??null))throw new Error("idempotency_conflict");
  return {id};
}

export async function respondMeeting(DB:D1Database,input:{roomId:string;proposalId:string;userId:string;response:"accepted"|"declined";now:number}){
  const context=await roomContext(DB,input.roomId,input.userId);
  const proposal=await DB.prepare("SELECT proposer_user_id AS proposerUserId FROM meeting_proposals WHERE id=? AND room_id=? AND status='proposed' LIMIT 1").bind(input.proposalId,input.roomId).first<{proposerUserId:string}>();
  if(!proposal){const existing=await DB.prepare("SELECT status,proposer_user_id AS proposerUserId FROM meeting_proposals WHERE id=? AND room_id=?").bind(input.proposalId,input.roomId).first<{status:string;proposerUserId:string}>();if(existing?.proposerUserId!==input.userId&&existing?.status===input.response)return;throw new Error("meeting_not_found");}
  if(proposal.proposerUserId===input.userId)throw new Error("meeting_not_found");
  const result=await DB.prepare("UPDATE meeting_proposals SET status=?,responded_by_user_id=?,responded_at=?,updated_at=? WHERE id=? AND room_id=? AND proposer_user_id<>? AND status='proposed'")
    .bind(input.response,input.userId,input.now,input.now,input.proposalId,input.roomId,input.userId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("meeting_not_found");
  await DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'meeting_response','immediate',?,? WHERE EXISTS (SELECT 1 FROM connection_sides WHERE connection_id=? AND user_id=? AND muted=0)").bind(`meeting-response:${input.proposalId}:${proposal.proposerUserId}`,proposal.proposerUserId,JSON.stringify({roomId:input.roomId,proposalId:input.proposalId,response:input.response}),input.now,context.connectionId,proposal.proposerUserId).run();
}

export async function getAcceptedMeetingForIcs(DB:D1Database,input:{roomId:string;proposalId:string;userId:string}){
  await roomContext(DB,input.roomId,input.userId);
  const proposal=await DB.prepare("SELECT starts_at AS startsAt,ends_at AS endsAt,timezone FROM meeting_proposals WHERE id=? AND room_id=? AND status='accepted' LIMIT 1").bind(input.proposalId,input.roomId).first<{startsAt:number;endsAt:number;timezone:string}>();
  if(!proposal)throw new Error("accepted_proposal_required");
  return proposal;
}

async function stableLifecycleId(prefix:string,...parts:string[]){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(parts.join("\u0000")));return `${prefix}_${Array.from(new Uint8Array(digest)).slice(0,16).map((value)=>value.toString(16).padStart(2,"0")).join("")}`}

export async function attachCalendarReceipt(DB:D1Database,input:{roomId:string;meetingProposalId:string;userId:string;provider:string;providerEventId:string;startsAt:number;endsAt:number;participantLabels:string[];status:"confirmed"|"cancelled";trustedProviderConfirmation:true;now:number}){
  await roomContext(DB,input.roomId,input.userId);
  if(input.endsAt<=input.startsAt)throw new Error("invalid_meeting_time");
  const accepted=await DB.prepare("SELECT 1 AS accepted FROM meeting_proposals WHERE id=? AND room_id=? AND status='accepted' AND starts_at=? AND ends_at=? LIMIT 1").bind(input.meetingProposalId,input.roomId,input.startsAt,input.endsAt).first();
  if(!input.trustedProviderConfirmation||!accepted)throw new Error("calendar_receipt_untrusted");
  const existing=await DB.prepare("SELECT id,room_id AS roomId FROM calendar_event_receipts WHERE provider=? AND provider_event_id=? LIMIT 1").bind(input.provider,input.providerEventId).first<{id:string;roomId:string}>();
  if(existing&&existing.roomId!==input.roomId)throw new Error("calendar_receipt_conflict");
  const id=crypto.randomUUID();
  await DB.prepare(`INSERT INTO calendar_event_receipts (id,room_id,meeting_proposal_id,attached_by_user_id,provider,provider_event_id,starts_at,ends_at,participant_labels_json,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_event_id) DO UPDATE SET meeting_proposal_id=excluded.meeting_proposal_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,participant_labels_json=excluded.participant_labels_json,status=excluded.status WHERE calendar_event_receipts.room_id=excluded.room_id AND calendar_event_receipts.meeting_proposal_id=excluded.meeting_proposal_id`)
    .bind(id,input.roomId,input.meetingProposalId,input.userId,input.provider,input.providerEventId,input.startsAt,input.endsAt,JSON.stringify(input.participantLabels),input.status,input.now).run();
  const stored=await DB.prepare("SELECT id FROM calendar_event_receipts WHERE provider=? AND provider_event_id=? AND room_id=? LIMIT 1").bind(input.provider,input.providerEventId,input.roomId).first<{id:string}>();
  if(!stored)throw new Error("calendar_receipt_conflict");
  return stored;
}

export async function markRoomRead(DB:D1Database,input:{roomId:string;userId:string;messageId:string|null;now:number}){
  const context=await roomContext(DB,input.roomId,input.userId);
  if(input.messageId){const message=await DB.prepare("SELECT 1 AS found FROM messages WHERE id=? AND room_id=? LIMIT 1").bind(input.messageId,input.roomId).first();if(!message)throw new Error("message_not_found");}
  await DB.batch([
    DB.prepare("UPDATE room_memberships SET last_read_message_id=? WHERE room_id=? AND user_id=? AND left_at IS NULL").bind(input.messageId,input.roomId,input.userId),
    DB.prepare("UPDATE connection_sides SET unread_at=NULL,updated_at=? WHERE connection_id=? AND user_id=?").bind(input.now,context.connectionId,input.userId),
  ]);
}
