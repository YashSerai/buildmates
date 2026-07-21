import { createD1Repositories } from "@buildmates/database";
import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, safeParseModuleAppearance, safeParseSurfaceSpec, seedDesignPolicy, type SurfaceSpec } from "@buildmates/surfaces";
import {consumeWebRateLimit} from "../security/rate-limit";

export type CircleListItem={id:string;name:string;purpose:string;status:string;governanceMode:"admin"|"vote";role:string;membershipStatus:string;memberCount:number};
export type CircleMember={userId:string;displayName:string;role:string;status:string;joinedAt:number|null};
export type CircleProposalView={id:string;proposerUserId:string;kind:string;status:string;governanceVersion:number;createdAt:number;payload:Record<string,unknown>;previewSpec:SurfaceSpec|null;canPublish:boolean;payloadJson?:undefined};
export type CircleModuleView={id:string;kind:string;rulesVersion:number;active:boolean;createdAt:number;config:Record<string,unknown>;configJson?:undefined};
export type CircleDetail={id:string;name:string;purpose:string;status:string;governanceMode:"admin"|"vote";governanceVersion:number;role:"member"|"admin"|"owner";membershipStatus:string;viewerUserId:string;surfaceId:string;publishedRevisionNumber:number|null;members:CircleMember[];proposals:CircleProposalView[];modules:CircleModuleView[]};
export type CircleMessage={id:string;senderUserId:string;senderName:string;body:string;createdAt:number;mine:boolean};
export type CircleModuleEntry={id:string;moduleId:string;authorUserId:string;authorName:string;payload:Record<string,unknown>;createdAt:number;updatedAt:number};
export type CircleSuggestion={id:string;memberUserIds:[string,string];memberNames:[string,string];reason:string};
export async function listCircles(DB:D1Database,userId:string):Promise<CircleListItem[]>{const rows=await DB.prepare(`SELECT c.id,c.name,c.purpose,c.status,c.governance_mode AS governanceMode,m.role,m.status AS membershipStatus,(SELECT COUNT(*) FROM circle_memberships active WHERE active.circle_id=c.id AND active.status='active') AS memberCount FROM circles c JOIN circle_memberships m ON m.circle_id=c.id AND m.user_id=? WHERE c.status<>'deleted' AND m.status IN ('invited','accepted','active') ORDER BY c.updated_at DESC LIMIT 100`).bind(userId).all<CircleListItem>();return rows.results}
export async function getCircle(DB:D1Database,circleId:string,userId:string):Promise<CircleDetail|null>{
  const circle=await DB.prepare(`SELECT c.id,c.name,c.purpose,c.status,c.governance_mode AS governanceMode,c.governance_version AS governanceVersion,
    m.role,m.status AS membershipStatus,surface.id AS surfaceId,published.revision_number AS publishedRevisionNumber
    FROM circles c JOIN circle_memberships m ON m.circle_id=c.id AND m.user_id=?
    JOIN surfaces surface ON surface.kind='circle' AND surface.subject_id=c.id
    LEFT JOIN surface_revisions published ON published.id=surface.published_revision_id
    WHERE c.id=? AND c.status<>'deleted' AND m.status IN ('invited','accepted','active') LIMIT 1`)
    .bind(userId,circleId).first<Omit<CircleDetail,"viewerUserId"|"members"|"proposals"|"modules">>();
  if(!circle)return null;
  if(await hasCircleBlock(DB,circleId,userId,false))return null;
  if(circle.membershipStatus!=="active")return {...circle,viewerUserId:userId,members:[],proposals:[],modules:[]};
  const [members,proposals,modules]=await Promise.all([
    DB.prepare("SELECT m.user_id AS userId,p.display_name AS displayName,m.role,m.status,m.joined_at AS joinedAt FROM circle_memberships m JOIN profiles p ON p.user_id=m.user_id WHERE m.circle_id=? AND m.status IN ('active','invited') ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,p.display_name LIMIT 200").bind(circleId).all<CircleMember>(),
    DB.prepare(`SELECT proposal.id,proposal.proposer_user_id AS proposerUserId,proposal.kind,proposal.payload_json AS payloadJson,proposal.status,
      proposal.governance_version AS governanceVersion,proposal.created_at AS createdAt,revision.spec_json AS previewSpecJson
      FROM circle_proposals proposal LEFT JOIN surface_revisions revision ON revision.id=json_extract(proposal.payload_json,'$.revisionId')
      WHERE proposal.circle_id=? ORDER BY proposal.created_at DESC LIMIT 50`).bind(circleId).all<Omit<CircleProposalView,"payload"|"payloadJson"|"previewSpec">&{payloadJson:string;previewSpecJson:string|null}>(),
    DB.prepare("SELECT id,kind,config_json AS configJson,rules_version AS rulesVersion,active,created_at AS createdAt FROM circle_modules WHERE circle_id=? ORDER BY created_at LIMIT 50").bind(circleId).all<Omit<CircleModuleView,"config"|"configJson"|"active">&{configJson:string;active:number}>(),
  ]);
  const viewerIsAdmin=circle.role==="owner"||circle.role==="admin";
  return {...circle,viewerUserId:userId,members:members.results,proposals:proposals.results.map(({previewSpecJson,...row})=>({...row,payload:safeObject(row.payloadJson),previewSpec:parseSurfacePreview(previewSpecJson),canPublish:row.kind!=="request"&&viewerIsAdmin&&row.status!=="published"&&row.governanceVersion===circle.governanceVersion&&(circle.governanceMode==="admin"||row.status==="approved"),payloadJson:undefined})),modules:modules.results.map((row)=>({...row,config:safeObject(row.configJson),configJson:undefined,active:Boolean(row.active)}))};
}
export async function createCircle(DB:D1Database,input:{actorId:string;name:string;purpose:string;governanceMode:"admin"|"vote";inviteeUserIds?:string[];now:number}){
  const user=await DB.prepare("SELECT 1 AS ok FROM users WHERE id=? AND status='active'").bind(input.actorId).first();
  if(!user)throw new Error("forbidden");
  const invitees=[...new Set(input.inviteeUserIds??[])].filter((id)=>id!==input.actorId).slice(0,20);
  for(const invitee of invitees){const allowed=await DB.prepare(`SELECT 1 AS ok FROM users target WHERE target.id=? AND target.status='active' AND EXISTS (SELECT 1 FROM connections connection JOIN match_pairs pair ON pair.id=connection.match_pair_id WHERE connection.state='active' AND ((pair.user_a_id=? AND pair.user_b_id=target.id) OR (pair.user_b_id=? AND pair.user_a_id=target.id))) AND NOT EXISTS (SELECT 1 FROM blocks block WHERE block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=target.id) OR (block.blocked_user_id=? AND block.blocker_user_id=target.id)))`).bind(invitee,input.actorId,input.actorId,input.actorId,input.actorId).first();if(!allowed)throw new Error("invite_invalid")}
  for(let left=0;left<invitees.length;left++)for(let right=left+1;right<invitees.length;right++)if(await blockedPair(DB,invitees[left]!,invitees[right]!))throw new Error("invite_blocked");
  const id=crypto.randomUUID();
  const surfaceId=`surface_circle_${id}`;
  const status=invitees.length?"proposed":"active";
  const statements=[
    DB.prepare("INSERT INTO circles (id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)").bind(id,input.name,input.purpose,status,input.governanceMode,input.now,input.now),
    DB.prepare("INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES (?,?,'owner','active',?)").bind(id,input.actorId,input.now),
    DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at) VALUES (?,?,'circle',?,NULL,1,?,?)").bind(surfaceId,input.actorId,id,input.now,input.now),
  ];
  for(const invitee of invitees){statements.push(DB.prepare("INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES (?,?,'member','invited',NULL)").bind(id,invitee),DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,'circle_invitation','immediate',?,?)").bind(`circle-invite:${id}:${invitee}`,invitee,JSON.stringify({circleId:id,circleName:input.name}),input.now))}
  await DB.batch(statements);
  return{id,status,surfaceId};
}
export async function listCircleSuggestions(DB:D1Database,userId:string):Promise<CircleSuggestion[]>{const rows=(await DB.prepare(`WITH mine AS (SELECT CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AS otherUserId FROM connections connection JOIN match_pairs pair ON pair.id=connection.match_pair_id WHERE connection.state='active' AND (pair.user_a_id=? OR pair.user_b_id=?)) SELECT first.otherUserId AS userA,profile_a.display_name AS nameA,second.otherUserId AS userB,profile_b.display_name AS nameB FROM mine first JOIN mine second ON first.otherUserId<second.otherUserId JOIN profiles profile_a ON profile_a.user_id=first.otherUserId JOIN profiles profile_b ON profile_b.user_id=second.otherUserId WHERE EXISTS (SELECT 1 FROM connections between_connection JOIN match_pairs between_pair ON between_pair.id=between_connection.match_pair_id WHERE between_connection.state='active' AND ((between_pair.user_a_id=first.otherUserId AND between_pair.user_b_id=second.otherUserId) OR (between_pair.user_b_id=first.otherUserId AND between_pair.user_a_id=second.otherUserId))) AND NOT EXISTS (SELECT 1 FROM circles circle JOIN circle_memberships me ON me.circle_id=circle.id AND me.user_id=? AND me.status='active' JOIN circle_memberships a ON a.circle_id=circle.id AND a.user_id=first.otherUserId AND a.status IN ('active','invited') JOIN circle_memberships b ON b.circle_id=circle.id AND b.user_id=second.otherUserId AND b.status IN ('active','invited') WHERE circle.status='active') LIMIT 6`).bind(userId,userId,userId,userId).all<{userA:string;nameA:string;userB:string;nameB:string}>()).results;return rows.map((row)=>({id:`${row.userA}:${row.userB}`,memberUserIds:[row.userA,row.userB],memberNames:[row.nameA,row.nameB],reason:`You already have active one-to-one connections with ${row.nameA} and ${row.nameB}, and they are connected to each other.`}))}
export async function inviteCircleMember(DB:D1Database,input:{actorId:string;circleId:string;userId:string;now:number}){if(input.actorId===input.userId)throw new Error("invite_invalid");const role=await activeRole(DB,input.circleId,input.actorId);if(role!=="owner"&&role!=="admin")throw new Error("forbidden");const target=await DB.prepare("SELECT 1 AS ok FROM users WHERE id=? AND status='active'").bind(input.userId).first();if(!target)throw new Error("user_not_found");const current=await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id=?").bind(input.circleId,input.userId).first<{status:string}>();if(current?.status==="active"||current?.status==="invited")return;if(await hasCircleBlock(DB,input.circleId,input.userId,true))throw new Error("invite_blocked");const circle=await DB.prepare("SELECT name FROM circles WHERE id=? LIMIT 1").bind(input.circleId).first<{name:string}>();await DB.batch([DB.prepare("INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES (?,?,'member','invited',NULL) ON CONFLICT(circle_id,user_id) DO UPDATE SET status='invited',joined_at=NULL WHERE circle_memberships.status IN ('left','declined','removed')").bind(input.circleId,input.userId),DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,read_at,created_at) SELECT ?,?,'circle_invitation','immediate',?,NULL,? WHERE EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND user_id=? AND status='invited') ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,read_at=NULL,created_at=excluded.created_at").bind(`circle-invite:${input.circleId}:${input.userId}`,input.userId,JSON.stringify({circleId:input.circleId,circleName:circle?.name??"Circle"}),input.now,input.circleId,input.userId)])}
export async function respondCircleInvite(DB:D1Database,input:{actorId:string;circleId:string;accept:boolean;now:number}){if(input.accept&&await hasCircleBlock(DB,input.circleId,input.actorId,false))throw new Error("invitation_blocked");const status=input.accept?"active":"declined";const results=await DB.batch([DB.prepare("UPDATE circle_memberships SET status=?,joined_at=CASE WHEN ?='active' THEN ? ELSE joined_at END WHERE circle_id=? AND user_id=? AND status='invited'").bind(status,status,input.now,input.circleId,input.actorId),DB.prepare(`UPDATE circles SET status=CASE WHEN ?='declined' THEN 'archived' WHEN status='proposed' AND NOT EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND status='invited') AND NOT EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND status='declined') THEN 'active' ELSE status END,governance_version=governance_version+1,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id=? AND user_id=? AND status=?)`).bind(status,input.circleId,input.circleId,input.now,input.circleId,input.circleId,input.actorId,status)]);if(Number(results[0]?.meta.changes??0)!==1)throw new Error("invitation_unavailable");await syncCircleSurfaceGovernance(DB,input.circleId)}
export async function createCircleProposal(DB:D1Database,input:{actorId:string;circleId:string;kind:"design"|"module"|"rules"|"request";payload:Record<string,unknown>;now:number}){
  if(!await activeUnblockedRole(DB,input.circleId,input.actorId))throw new Error("forbidden");
  const circle=await DB.prepare(`SELECT circle.governance_mode AS governanceMode,circle.governance_version AS governanceVersion,
    surface.id AS surfaceId,published.revision_number AS publishedRevisionNumber
    FROM circles circle JOIN surfaces surface ON surface.kind='circle' AND surface.subject_id=circle.id
    LEFT JOIN surface_revisions published ON published.id=surface.published_revision_id
    WHERE circle.id=? AND circle.status='active'`).bind(input.circleId).first<{governanceMode:"admin"|"vote";governanceVersion:number;surfaceId:string;publishedRevisionNumber:number|null}>();
  if(!circle)throw new Error("circle_unavailable");
  const id=crypto.randomUUID();
  let storedPayload=input.payload;
  if(input.kind==="request")storedPayload=validateChangeRequest(input.payload);
  if(input.kind==="module")validateModulePayload(input.payload);
  if(input.kind==="rules"){
    const rules=validateRulesPayload(input.payload);
    const target=await DB.prepare("SELECT 1 AS ok FROM circle_modules WHERE id=? AND circle_id=? AND active=1").bind(rules.moduleId,input.circleId).first();
    if(!target)throw new Error("module_unavailable");
  }
  if(input.kind==="design"){
    const spec=safeParseSurfaceSpec(input.payload.spec,DESIGN_POLICY_VERSION,{forRevisionCreation:true});
    if(!spec.success||spec.data.kind!=="circle")throw new Error("surface_spec_invalid");
    const repositories=createD1Repositories(DB);
    await seedDesignPolicy(repositories);
    const maximum=await DB.prepare("SELECT COALESCE(MAX(revision_number),0) AS value FROM surface_revisions WHERE surface_id=?").bind(circle.surfaceId).first<{value:number}>();
    const revisionId=`revision_${crypto.randomUUID()}`;
    await repositories.surfaces.createRevision({actorId:input.actorId as never,id:revisionId,surfaceId:circle.surfaceId,authorUserId:input.actorId as never,revisionNumber:Number(maximum?.value??0)+1,baseRevisionNumber:circle.publishedRevisionNumber,designPolicyId:DESIGN_POLICY_ID,designPolicyVersion:DESIGN_POLICY_VERSION,visibility:"private_preview",specJson:JSON.stringify(spec.data),createdAt:new Date(input.now)});
    storedPayload={title:typeof input.payload.title==="string"?input.payload.title:"Circle design",revisionId};
  }
  const status=input.kind==="request"?"draft":circle.governanceMode==="vote"?"voting":"draft";
  await DB.prepare("INSERT INTO circle_proposals (id,circle_id,proposer_user_id,kind,payload_json,governance_version,status,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,input.circleId,input.actorId,input.kind,boundedJson(storedPayload),circle.governanceVersion,status,input.now).run();
  return{id,status,revisionId:typeof storedPayload.revisionId==="string"?storedPayload.revisionId:null};
}
export async function voteCircleProposal(DB:D1Database,input:{actorId:string;circleId:string;proposalId:string;vote:"approve"|"reject"|"abstain";now:number}){
  if(!await activeUnblockedRole(DB,input.circleId,input.actorId))throw new Error("forbidden");
  const proposal=await DB.prepare("SELECT p.kind,p.payload_json AS payloadJson,p.governance_version AS governanceVersion FROM circle_proposals p JOIN circles c ON c.id=p.circle_id WHERE p.id=? AND p.circle_id=? AND p.status='voting' AND p.governance_version=c.governance_version AND c.governance_mode='vote' AND c.status='active'").bind(input.proposalId,input.circleId).first<{kind:string;payloadJson:string;governanceVersion:number}>();
  if(!proposal)throw new Error("proposal_unavailable");
  await DB.batch([DB.prepare("INSERT INTO circle_votes (proposal_id,user_id,vote,created_at) VALUES (?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET vote=excluded.vote,created_at=excluded.created_at").bind(input.proposalId,input.actorId,input.vote,input.now),DB.prepare("UPDATE circle_proposals SET status=CASE WHEN (SELECT COUNT(*) FROM circle_votes v JOIN circle_memberships m ON m.circle_id=circle_proposals.circle_id AND m.user_id=v.user_id AND m.status='active' WHERE v.proposal_id=circle_proposals.id AND v.vote='approve')>(SELECT COUNT(*) FROM circle_memberships m WHERE m.circle_id=circle_proposals.circle_id AND m.status='active')/2.0 THEN 'approved' ELSE 'voting' END WHERE id=? AND circle_id=? AND status='voting'").bind(input.proposalId,input.circleId)]);
  if(proposal.kind==="design"){
    const revisionId=safeObject(proposal.payloadJson).revisionId;
    if(typeof revisionId!=="string")throw new Error("surface_revision_missing");
    await createD1Repositories(DB).surfaces.decideRevision({actorId:input.actorId as never,revisionId,governanceVersion:proposal.governanceVersion,decision:input.vote==="approve"?"approved":"rejected",at:new Date(input.now)});
  }
}
export async function publishCircleProposal(DB:D1Database,input:{actorId:string;circleId:string;proposalId:string;now:number}){
  const role=await activeUnblockedRole(DB,input.circleId,input.actorId);
  if(!role)throw new Error("forbidden");
  const proposal=await DB.prepare(`SELECT p.kind,p.payload_json AS payloadJson,p.status,c.governance_mode AS governanceMode,c.governance_version AS governanceVersion,
    surface.id AS surfaceId,published.revision_number AS publishedRevisionNumber
    FROM circle_proposals p JOIN circles c ON c.id=p.circle_id JOIN surfaces surface ON surface.kind='circle' AND surface.subject_id=c.id
    LEFT JOIN surface_revisions published ON published.id=surface.published_revision_id
    WHERE p.id=? AND p.circle_id=? AND p.governance_version=c.governance_version AND c.status='active'`).bind(input.proposalId,input.circleId).first<{kind:string;payloadJson:string;status:string;governanceMode:"admin"|"vote";governanceVersion:number;surfaceId:string;publishedRevisionNumber:number|null}>();
  if(!proposal)throw new Error("proposal_unavailable");
  if(proposal.status==="published")return;
  if(proposal.kind==="request")throw new Error("request_requires_codex_proposal");
  const admin=role==="owner"||role==="admin";
  if(!admin)throw new Error("forbidden");
  if(proposal.governanceMode==="vote"&&proposal.status!=="approved")throw new Error("proposal_not_approved");
  const payload=safeObject(proposal.payloadJson);
  if(proposal.kind==="design"){
    const revisionId=payload.revisionId;
    if(typeof revisionId!=="string")throw new Error("surface_revision_missing");
    const surfaces=createD1Repositories(DB).surfaces;
    if(proposal.governanceMode==="admin")await surfaces.decideRevision({actorId:input.actorId as never,revisionId,governanceVersion:proposal.governanceVersion,decision:"approved",at:new Date(input.now)});
    await surfaces.publishRevision({actorId:input.actorId as never,surfaceId:proposal.surfaceId,revisionId,expectedPublishedRevisionNumber:proposal.publishedRevisionNumber,governanceVersion:proposal.governanceVersion,proposalId:proposal.governanceMode==="vote"?input.proposalId:undefined,at:new Date(input.now)});
    await DB.prepare("UPDATE circle_proposals SET status='published' WHERE id=? AND status<>'published'").bind(input.proposalId).run();
    return;
  }
  const statements=[DB.prepare("UPDATE circle_proposals SET status='published' WHERE id=? AND status<>'published'").bind(input.proposalId)];
  if(proposal.kind==="module"){
    const moduleInput=validateModulePayload(payload);
    statements.push(DB.prepare("INSERT INTO circle_modules (id,circle_id,kind,config_json,rules_version,active,created_at,updated_at) VALUES (?,?,?,?,1,1,?,?)").bind(`circle-module-${input.proposalId}`,input.circleId,moduleInput.kind,JSON.stringify(moduleInput.config),input.now,input.now));
  }
  if(proposal.kind==="rules"){
    const rules=validateRulesPayload(payload);
    statements.push(
      DB.prepare(`INSERT INTO circle_module_rule_versions (module_id,version,proposal_id,rules_json,approved_by_user_id,created_at)
        SELECT module.id,module.rules_version+1,?,?,?,? FROM circle_modules module WHERE module.id=? AND module.circle_id=? AND module.active=1`).bind(input.proposalId,JSON.stringify(rules.rules),input.actorId,input.now,rules.moduleId,input.circleId),
      DB.prepare("UPDATE circle_modules SET config_json=json_set(config_json,'$.rules',json(?)),rules_version=rules_version+1,updated_at=? WHERE id=? AND circle_id=? AND active=1 AND EXISTS (SELECT 1 FROM circle_module_rule_versions version WHERE version.proposal_id=? AND version.module_id=circle_modules.id)").bind(JSON.stringify(rules.rules),input.now,rules.moduleId,input.circleId,input.proposalId),
    );
  }
  try{await DB.batch(statements)}catch(error){const published=await DB.prepare("SELECT 1 AS ok FROM circle_proposals WHERE id=? AND status='published'").bind(input.proposalId).first();if(!published)throw error}
}
export async function addCircleModuleEntry(DB:D1Database,input:{actorId:string;circleId:string;moduleId:string;payload:Record<string,unknown>;now:number}){
  if(!await activeUnblockedRole(DB,input.circleId,input.actorId))throw new Error("forbidden");
  const moduleRow=await DB.prepare("SELECT kind FROM circle_modules WHERE id=? AND circle_id=? AND active=1").bind(input.moduleId,input.circleId).first<{kind:string}>();
  if(!moduleRow)throw new Error("module_unavailable");
  const payload=validateEntryPayload(moduleRow.kind,input.payload);
  const id=crypto.randomUUID();
  await DB.prepare("INSERT INTO circle_module_entries (id,module_id,author_user_id,payload_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)").bind(id,input.moduleId,input.actorId,JSON.stringify(payload),input.now,input.now).run();
  return{id};
}
export async function updateCircleModuleEntry(DB:D1Database,input:{actorId:string;circleId:string;moduleId:string;entryId:string;payload:Record<string,unknown>;now:number}){
  if(!await activeUnblockedRole(DB,input.circleId,input.actorId))throw new Error("forbidden");
  const moduleRow=await DB.prepare("SELECT kind FROM circle_modules WHERE id=? AND circle_id=? AND active=1").bind(input.moduleId,input.circleId).first<{kind:string}>();
  if(!moduleRow)throw new Error("module_unavailable");
  const payload=validateEntryPayload(moduleRow.kind,input.payload);
  const result=await DB.prepare("UPDATE circle_module_entries SET payload_json=?,updated_at=? WHERE id=? AND module_id=? AND author_user_id=? AND deleted_at IS NULL").bind(JSON.stringify(payload),input.now,input.entryId,input.moduleId,input.actorId).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("entry_not_found");
}
export async function deleteCircleModuleEntry(DB:D1Database,input:{actorId:string;circleId:string;moduleId:string;entryId:string;now:number}){
  const role=await activeUnblockedRole(DB,input.circleId,input.actorId);
  if(!role)throw new Error("forbidden");
  const result=await DB.prepare(`UPDATE circle_module_entries SET payload_json='{}',updated_at=?,deleted_at=? WHERE id=? AND module_id=? AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM circle_modules module WHERE module.id=circle_module_entries.module_id AND module.circle_id=? AND module.active=1)
    AND (author_user_id=? OR ? IN ('owner','admin'))`).bind(input.now,input.now,input.entryId,input.moduleId,input.circleId,input.actorId,role).run();
  if(Number(result.meta?.changes??0)!==1)throw new Error("entry_not_found");
}
export async function listCircleModuleEntries(DB:D1Database,circleId:string,userId:string):Promise<CircleModuleEntry[]>{if(!await activeUnblockedRole(DB,circleId,userId))throw new Error("forbidden");const rows=await DB.prepare(`SELECT entry.id,entry.module_id AS moduleId,entry.author_user_id AS authorUserId,profile.display_name AS authorName,entry.payload_json AS payloadJson,entry.created_at AS createdAt,entry.updated_at AS updatedAt FROM circle_module_entries entry JOIN circle_modules module ON module.id=entry.module_id AND module.circle_id=? AND module.active=1 JOIN profiles profile ON profile.user_id=entry.author_user_id WHERE entry.deleted_at IS NULL ORDER BY entry.created_at DESC LIMIT 300`).bind(circleId).all<Omit<CircleModuleEntry,"payload">&{payloadJson:string}>();return rows.results.map(({payloadJson,...row})=>({...row,payload:safeObject(payloadJson)}))}
export async function listCircleMessages(DB:D1Database,circleId:string,userId:string,limit=100):Promise<CircleMessage[]>{if(!await activeUnblockedRole(DB,circleId,userId))throw new Error("forbidden");const rows=await DB.prepare(`SELECT message.id,message.sender_user_id AS senderUserId,profile.display_name AS senderName,message.body,message.created_at AS createdAt FROM circle_messages message JOIN profiles profile ON profile.user_id=message.sender_user_id WHERE message.circle_id=? AND message.deleted_at IS NULL ORDER BY message.created_at DESC,message.id DESC LIMIT ?`).bind(circleId,Math.max(1,Math.min(100,limit))).all<Omit<CircleMessage,"mine">>();return rows.results.reverse().map((row)=>({...row,mine:row.senderUserId===userId}))}
export async function sendCircleMessage(DB:D1Database,input:{actorId:string;circleId:string;clientMessageId:string;body:string;now:number}){if(!await activeUnblockedRole(DB,input.circleId,input.actorId))throw new Error("forbidden");await consumeWebRateLimit(DB,"circle_message",input.actorId,30,60_000,input.now);const body=input.body.trim();if(!body||body.length>4000)throw new Error("message_invalid");const context=await DB.prepare("SELECT circle.name AS circleName,profile.display_name AS senderName FROM circles circle JOIN profiles profile ON profile.user_id=? WHERE circle.id=? LIMIT 1").bind(input.actorId,input.circleId).first<{circleName:string;senderName:string}>();const id=crypto.randomUUID();await DB.batch([DB.prepare("INSERT INTO circle_messages (id,circle_id,sender_user_id,client_message_id,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(circle_id,sender_user_id,client_message_id) DO NOTHING").bind(id,input.circleId,input.actorId,input.clientMessageId,body,input.now),DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?||':'||member.user_id,member.user_id,'circle_message','immediate',?,? FROM circle_memberships member WHERE member.circle_id=? AND member.status='active' AND member.user_id<>? AND EXISTS (SELECT 1 FROM circle_messages WHERE id=?) AND NOT EXISTS (SELECT 1 FROM blocks block WHERE block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=member.user_id) OR (block.blocked_user_id=? AND block.blocker_user_id=member.user_id)))").bind(`circle-message:${id}`,JSON.stringify({circleId:input.circleId,messageId:id,circleName:context?.circleName??"your Circle",senderName:context?.senderName??"A member"}),input.now,input.circleId,input.actorId,id,input.actorId,input.actorId)]);const stored=await DB.prepare("SELECT id,created_at AS createdAt FROM circle_messages WHERE circle_id=? AND sender_user_id=? AND client_message_id=?").bind(input.circleId,input.actorId,input.clientMessageId).first<{id:string;createdAt:number}>();if(!stored)throw new Error("message_failed");return stored}
export async function inviteCircleMemberByHandle(DB:D1Database,input:{actorId:string;circleId:string;handle:string;now:number}){const target=await DB.prepare("SELECT user_id AS userId FROM handles WHERE handle=? LIMIT 1").bind(input.handle.trim().toLowerCase().replace(/^@/,"")).first<{userId:string}>();if(!target)throw new Error("user_not_found");return inviteCircleMember(DB,{...input,userId:target.userId})}
export async function manageCircleMember(DB:D1Database,input:{actorId:string;circleId:string;targetUserId:string;action:"promote"|"demote"|"remove"|"transfer"}){const actor=await activeRole(DB,input.circleId,input.actorId);if(!actor||!["owner","admin"].includes(actor))throw new Error("forbidden");const target=await DB.prepare("SELECT role,status FROM circle_memberships WHERE circle_id=? AND user_id=?").bind(input.circleId,input.targetUserId).first<{role:string;status:string}>();if(!target||target.status!=="active")throw new Error("member_unavailable");if(input.action!=="remove"&&actor!=="owner")throw new Error("owner_required");if(target.role==="owner")throw new Error("owner_protected");if(input.action==="promote"&&target.role==="admin")throw new Error("member_unavailable");if(input.action==="demote"&&target.role==="member")throw new Error("member_unavailable");if(input.action==="transfer"){const result=await DB.batch([DB.prepare("UPDATE circle_memberships SET role='admin' WHERE circle_id=? AND user_id=? AND role='owner'").bind(input.circleId,input.actorId),DB.prepare("UPDATE circle_memberships SET role='owner' WHERE circle_id=? AND user_id=? AND status='active' AND role<>'owner'").bind(input.circleId,input.targetUserId),DB.prepare("UPDATE circles SET governance_version=governance_version+1,updated_at=? WHERE id=?").bind(Date.now(),input.circleId)]);if(result.some((row)=>!row.success)||Number(result[0]?.meta.changes)!==1||Number(result[1]?.meta.changes)!==1)throw new Error("transfer_failed");await syncCircleSurfaceGovernance(DB,input.circleId);return}const update=input.action==="promote"?DB.prepare("UPDATE circle_memberships SET role='admin' WHERE circle_id=? AND user_id=? AND role='member' AND status='active'").bind(input.circleId,input.targetUserId):input.action==="demote"?DB.prepare("UPDATE circle_memberships SET role='member' WHERE circle_id=? AND user_id=? AND role='admin' AND status='active'").bind(input.circleId,input.targetUserId):DB.prepare("UPDATE circle_memberships SET status='removed' WHERE circle_id=? AND user_id=? AND role<>'owner'").bind(input.circleId,input.targetUserId);const results=await DB.batch([update,DB.prepare("UPDATE circles SET governance_version=governance_version+1,updated_at=? WHERE id=?").bind(Date.now(),input.circleId)]);if(Number(results[0]?.meta.changes)!==1)throw new Error("member_unavailable");await syncCircleSurfaceGovernance(DB,input.circleId)}
export async function leaveCircle(DB:D1Database,input:{actorId:string;circleId:string}){const role=await activeRole(DB,input.circleId,input.actorId);if(!role)throw new Error("forbidden");if(role==="owner")throw new Error("transfer_owner_first");const left=await DB.prepare("UPDATE circle_memberships SET status='left' WHERE circle_id=? AND user_id=? AND status='active'").bind(input.circleId,input.actorId).run();if(Number(left.meta?.changes??0)!==1)throw new Error("member_unavailable");await DB.prepare("UPDATE circles SET governance_version=governance_version+1,updated_at=? WHERE id=? AND status='active'").bind(Date.now(),input.circleId).run();await syncCircleSurfaceGovernance(DB,input.circleId)}
async function activeRole(DB:D1Database,circleId:string,userId:string){const row=await DB.prepare("SELECT membership.role FROM circle_memberships membership JOIN circles circle ON circle.id=membership.circle_id AND circle.status='active' WHERE membership.circle_id=? AND membership.user_id=? AND membership.status='active'").bind(circleId,userId).first<{role:"member"|"admin"|"owner"}>();return row?.role??null}
async function syncCircleSurfaceGovernance(DB:D1Database,circleId:string){await DB.prepare("UPDATE surfaces SET governance_version=(SELECT governance_version FROM circles WHERE id=?),updated_at=? WHERE kind='circle' AND subject_id=? AND EXISTS (SELECT 1 FROM circles WHERE id=?)").bind(circleId,Date.now(),circleId,circleId).run()}
async function activeUnblockedRole(DB:D1Database,circleId:string,userId:string){const role=await activeRole(DB,circleId,userId);return role&&!await hasCircleBlock(DB,circleId,userId,false)?role:null}
async function hasCircleBlock(DB:D1Database,circleId:string,userId:string,includeInvited:boolean){const statuses=includeInvited?"('active','invited')":"('active')";return Boolean(await DB.prepare(`SELECT 1 AS blocked FROM circle_memberships member JOIN blocks block ON block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=member.user_id) OR (block.blocked_user_id=? AND block.blocker_user_id=member.user_id)) WHERE member.circle_id=? AND member.status IN ${statuses} AND member.user_id<>? LIMIT 1`).bind(userId,userId,circleId,userId).first())}
async function blockedPair(DB:D1Database,left:string,right:string){return Boolean(await DB.prepare("SELECT 1 AS blocked FROM blocks WHERE revoked_at IS NULL AND ((blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)) LIMIT 1").bind(left,right,right,left).first())}
const moduleKinds=["resource_shelf","experiment_tracker","decision_log","feedback_queue","milestone_tracker","scoreboard"] as const;
function validateModulePayload(payload:Record<string,unknown>){
  if(!moduleKinds.includes(payload.kind as typeof moduleKinds[number])||!payload.config||typeof payload.config!=="object"||Array.isArray(payload.config))throw new Error("module_payload_invalid");
  const config=payload.config as Record<string,unknown>;
  if(typeof config.title!=="string"||config.title.trim().length<1||config.title.length>120)throw new Error("module_payload_invalid");
  if(config.appearance&&!safeParseModuleAppearance(config.appearance).success)throw new Error("module_appearance_invalid");
  return{kind:payload.kind as typeof moduleKinds[number],config:{...config,title:config.title.trim()}}
}
function validateRulesPayload(payload:Record<string,unknown>){
  if(typeof payload.moduleId!=="string"||!payload.moduleId||!payload.rules||typeof payload.rules!=="object"||Array.isArray(payload.rules))throw new Error("rules_payload_invalid");
  const rules=payload.rules as Record<string,unknown>;
  if(typeof rules.title!=="string"||rules.title.trim().length<1||rules.title.length>120||typeof rules.description!=="string"||rules.description.trim().length<1||rules.description.length>1000)throw new Error("rules_payload_invalid");
  return{moduleId:payload.moduleId,rules:{title:rules.title.trim(),description:rules.description.trim()}};
}
function validateChangeRequest(payload:Record<string,unknown>){
  if(typeof payload.change!=="string"||typeof payload.outcome!=="string")throw new Error("change_request_invalid");
  const change=payload.change.trim();
  const outcome=payload.outcome.trim();
  if(change.length<3||change.length>1200||outcome.length<3||outcome.length>1200)throw new Error("change_request_invalid");
  return{change,outcome};
}
export function validateEntryPayload(kind:string,payload:Record<string,unknown>):Record<string,string>{
  const fields:Record<string,readonly string[]>={
    resource_shelf:["title","url","note"],experiment_tracker:["title","hypothesis","status","outcome"],decision_log:["decision","rationale"],feedback_queue:["feedback","status"],milestone_tracker:["milestone","dueDate","status"],scoreboard:["label","value","note"],
  };
  const allowed=fields[kind];
  if(!allowed)throw new Error("module_unavailable");
  const normalized:Record<string,string>={};
  for(const key of allowed){const value=payload[key];if(typeof value==="string"&&value.trim())normalized[key]=value.trim().slice(0,2000)}
  const primary=allowed[0];
  if(!primary||!normalized[primary])throw new Error("entry_payload_invalid");
  if(kind==="resource_shelf"&&normalized.url&&!/^https?:\/\//i.test(normalized.url))throw new Error("entry_payload_invalid");
  return normalized;
}
function parseSurfacePreview(value:string|null):SurfaceSpec|null{if(!value)return null;try{const parsed=safeParseSurfaceSpec(JSON.parse(value));return parsed.success&&parsed.data.kind==="circle"?parsed.data:null}catch{return null}}
function safeObject(value:string):Record<string,unknown>{try{const parsed:unknown=JSON.parse(value);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{} }catch{return {}}}
function boundedJson(value:Record<string,unknown>){const json=JSON.stringify(value);if(json.length>16_384)throw new Error("payload_too_large");return json}
