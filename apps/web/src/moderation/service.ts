export type ModerationCaseView={caseId:string;reportId:string;reporterUserId:string;targetKind:string;targetId:string;reasonCode:string;details:string|null;reportStatus:string;caseStatus:string;assignedOperatorId:string|null;createdAt:number;targetUserId:string|null};
export type ReporterStatus={reportId:string;targetKind:string;targetId:string;reasonCode:string;status:string;createdAt:number};
export type AppealableOutcome={caseId:string;action:string;reasonCode:string;caseStatus:string;createdAt:number;appealStatus:string|null};

export async function listModerationCases(DB:D1Database,status="open"):Promise<ModerationCaseView[]>{
  const allowed=new Set(["open","reviewing","actioned","closed","appealed"]);const selected=allowed.has(status)?status:"open";
  const rows=await DB.prepare(`SELECT c.id AS caseId,r.id AS reportId,r.reporter_user_id AS reporterUserId,r.target_kind AS targetKind,r.target_id AS targetId,r.reason_code AS reasonCode,r.details,r.status AS reportStatus,c.status AS caseStatus,c.assigned_operator_id AS assignedOperatorId,c.created_at AS createdAt FROM moderation_cases c JOIN reports r ON r.id=c.report_id WHERE c.status=? ORDER BY c.created_at ASC LIMIT 100`).bind(selected).all<Omit<ModerationCaseView,"targetUserId">>();
  return Promise.all(rows.results.map(async row=>({...row,targetUserId:await resolveTargetUser(DB,row.targetKind,row.targetId)})));
}
export async function listReporterStatus(DB:D1Database,userId:string):Promise<ReporterStatus[]>{const rows=await DB.prepare("SELECT id AS reportId,target_kind AS targetKind,target_id AS targetId,reason_code AS reasonCode,status,created_at AS createdAt FROM reports WHERE reporter_user_id=? ORDER BY created_at DESC LIMIT 100").bind(userId).all<ReporterStatus>();return rows.results}

export async function listAppealableOutcomes(DB:D1Database,userId:string):Promise<AppealableOutcome[]>{
  const rows=await DB.prepare(`SELECT c.id AS caseId,c.status AS caseStatus,r.target_kind AS targetKind,r.target_id AS targetId,a.action,a.reason_code AS reasonCode,a.created_at AS createdAt,
    (SELECT status FROM moderation_appeals appeal WHERE appeal.case_id=c.id AND appeal.appellant_user_id=? ORDER BY appeal.created_at DESC LIMIT 1) AS appealStatus
    FROM moderation_cases c JOIN reports r ON r.id=c.report_id JOIN moderation_actions a ON a.case_id=c.id
    WHERE c.status IN ('actioned','appealed') ORDER BY a.created_at DESC LIMIT 100`).bind(userId).all<AppealableOutcome & {targetKind:string;targetId:string}>();
  const outcomes:AppealableOutcome[]=[];
  for(const row of rows.results)if(await resolveTargetUser(DB,row.targetKind,row.targetId)===userId)outcomes.push({caseId:row.caseId,action:row.action,reasonCode:row.reasonCode,caseStatus:row.caseStatus,createdAt:row.createdAt,appealStatus:row.appealStatus});
  return outcomes;
}

export async function moderateCase(DB:D1Database,input:{operatorId:string;caseId:string;action:"review"|"dismiss"|"warn"|"restrict_matching"|"suspend_account";reasonCode:string;now:number}){
  const row=await DB.prepare("SELECT c.status,r.target_kind AS targetKind,r.target_id AS targetId FROM moderation_cases c JOIN reports r ON r.id=c.report_id WHERE c.id=?").bind(input.caseId).first<{status:string;targetKind:string;targetId:string}>();
  if(!row||["closed","actioned"].includes(row.status))throw new Error("case_unavailable");
  const targetUserId=await resolveTargetUser(DB,row.targetKind,row.targetId);
  if(["warn","restrict_matching","suspend_account"].includes(input.action)&&!targetUserId)throw new Error("target_user_unavailable");
  if(input.action==="review"){
    const results=await DB.batch([
      DB.prepare("UPDATE moderation_cases SET status='reviewing',assigned_operator_id=?,updated_at=? WHERE id=? AND status IN ('open','appealed')").bind(input.operatorId,input.now,input.caseId),
      DB.prepare("UPDATE reports SET status='reviewing',updated_at=? WHERE id=(SELECT report_id FROM moderation_cases WHERE id=? AND status='reviewing' AND assigned_operator_id=? AND updated_at=?)").bind(input.now,input.caseId,input.operatorId,input.now),
    ]);
    if(Number(results[0]?.meta?.changes??0)!==1)throw new Error("case_unavailable");return;
  }
  const dismissed=input.action==="dismiss";const finalStatus=dismissed?"closed":"actioned";const reportStatus=dismissed?"closed":"actioned";const actionId=crypto.randomUUID();
  const statements:D1PreparedStatement[]=[
    DB.prepare("UPDATE moderation_cases SET status=?,assigned_operator_id=?,updated_at=? WHERE id=? AND status IN ('open','reviewing','appealed') AND (assigned_operator_id IS NULL OR assigned_operator_id=?)").bind(finalStatus,input.operatorId,input.now,input.caseId,input.operatorId),
    DB.prepare("INSERT INTO moderation_actions (id,case_id,operator_user_id,action,reason_code,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM moderation_cases WHERE id=? AND status=? AND assigned_operator_id=? AND updated_at=?)").bind(actionId,input.caseId,input.operatorId,input.action,input.reasonCode,input.now,input.caseId,finalStatus,input.operatorId,input.now),
    DB.prepare("UPDATE reports SET status=?,updated_at=? WHERE id=(SELECT report_id FROM moderation_cases WHERE id=?) AND EXISTS (SELECT 1 FROM moderation_actions WHERE id=?)").bind(reportStatus,input.now,input.caseId,actionId),
  ];
  if(targetUserId&&!dismissed)statements.push(DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'moderation_outcome','immediate',?,? WHERE EXISTS (SELECT 1 FROM moderation_actions WHERE id=?)").bind(crypto.randomUUID(),targetUserId,JSON.stringify({caseId:input.caseId,action:input.action}),input.now,actionId));
  if(targetUserId&&input.action==="restrict_matching")statements.push(...matchingRestriction(DB,targetUserId,input.now,false,actionId));
  if(targetUserId&&input.action==="suspend_account")statements.push(DB.prepare("UPDATE users SET status='suspended',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM moderation_actions WHERE id=?)").bind(input.now,targetUserId,actionId),...matchingRestriction(DB,targetUserId,input.now,true,actionId));
  const results=await DB.batch(statements);if(Number(results[0]?.meta?.changes??0)!==1)throw new Error("case_unavailable");
}

export async function appealModerationCase(DB:D1Database,input:{userId:string;caseId:string;statement:string;now:number}){const row=await DB.prepare("SELECT c.status,r.target_kind AS targetKind,r.target_id AS targetId FROM moderation_cases c JOIN reports r ON r.id=c.report_id WHERE c.id=?").bind(input.caseId).first<{status:string;targetKind:string;targetId:string}>();if(!row||await resolveTargetUser(DB,row.targetKind,row.targetId)!==input.userId)throw new Error("case_unavailable");const existing=await DB.prepare("SELECT 1 AS ok FROM moderation_appeals WHERE case_id=? AND appellant_user_id=? AND status IN ('received','reviewing')").bind(input.caseId,input.userId).first();if(existing)return;if(row.status!=="actioned")throw new Error("case_unavailable");await DB.batch([DB.prepare("INSERT INTO moderation_appeals (id,case_id,appellant_user_id,statement,status,created_at) VALUES (?,?,?,?,'received',?)").bind(crypto.randomUUID(),input.caseId,input.userId,input.statement,input.now),DB.prepare("UPDATE moderation_cases SET status='appealed',updated_at=? WHERE id=? AND status='actioned'").bind(input.now,input.caseId)])}

function matchingRestriction(DB:D1Database,userId:string,now:number,endRelationships:boolean,actionId:string){
  const gate="EXISTS (SELECT 1 FROM moderation_actions WHERE id=?)";
  const statements=[
    DB.prepare(`UPDATE profiles SET allow_matching=0,updated_at=? WHERE user_id=? AND ${gate}`).bind(now,userId,actionId),
    DB.prepare(`DELETE FROM builder_match_index WHERE user_id=? AND ${gate}`).bind(userId,actionId),
    DB.prepare(`DELETE FROM candidate_batches WHERE user_id=? AND ${gate}`).bind(userId,actionId),
    DB.prepare(`DELETE FROM pair_scores WHERE (user_a_id=? OR user_b_id=?) AND ${gate}`).bind(userId,userId,actionId),
    DB.prepare(`UPDATE match_proposals SET state='invalidated',terminal_at=? WHERE state='pending' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?) AND ${gate}`).bind(now,userId,userId,actionId),
  ];
  if(endRelationships)statements.push(
    DB.prepare(`UPDATE connections SET state='ended',ended_by_user_id=?,ended_at=?,updated_at=? WHERE state='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?) AND ${gate}`).bind(userId,now,now,userId,userId,actionId),
    DB.prepare(`UPDATE rooms SET status='ended',updated_at=? WHERE status='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?) AND ${gate}`).bind(now,userId,userId,actionId),
  );
  return statements;
}
async function resolveTargetUser(DB:D1Database,kind:string,id:string):Promise<string|null>{if(kind==="user")return(await DB.prepare("SELECT id FROM users WHERE id=?").bind(id).first<{id:string}>())?.id??null;if(kind==="profile")return(await DB.prepare("SELECT user_id AS id FROM profiles WHERE id=?").bind(id).first<{id:string}>())?.id??null;if(kind==="project")return(await DB.prepare("SELECT owner_user_id AS id FROM projects WHERE id=?").bind(id).first<{id:string}>())?.id??null;if(kind==="message")return(await DB.prepare("SELECT sender_user_id AS id FROM messages WHERE id=?").bind(id).first<{id:string}>())?.id??null;return null}
