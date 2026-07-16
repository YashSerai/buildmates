export type Audience = "public" | "signed_in" | "suggested_connections" | "mutual_connections" | "private";
export const AUDIENCES: Audience[] = ["public", "signed_in", "suggested_connections", "mutual_connections", "private"];
export const PROFILE_FIELD_KEYS = ["current_work", "previous_work", "interests", "ambitions", "stage", "exploring", "offers", "needs", "networking_intent", "cohorts"] as const;

type Viewer = string | null;
type ProfileFieldInput = { key: typeof PROFILE_FIELD_KEYS[number]; value: string | string[]; audience: Audience; allowMatching?: boolean; sourceStatus?: "generated" | "confirmed"; provenance?: "self_reported" | "codex_summary" | "connected_app" | "system" };
export type ProfileInput = { handle: string; displayName: string; summary: string; audience: Audience; indexable: boolean; allowMatching: boolean; acceptanceMode: "manual" | "full_autopilot"; coarseLocation?: string; locationMapOptIn?: boolean; timezone?: string; projectOrInterest?: string; portfolioLinks?: string[]; fields: ProfileFieldInput[]; statistics?: {key:string;label:string;value:string;provenance:"self_reported"|"connected_app"|"system";audience:Audience}[] };
export type ProjectInput = { slug: string; title: string; summary: string; audience: Audience; allowMatching: boolean; indexable: boolean; stage: string; status: "draft" | "active" | "archived"; links?: { label: string; url: string }[]; taxonomy?: { kind: "topic" | "tool" | "domain"; id: string }[] };
type ProfileRow={id:string;userId:string;handle:string;displayName:string;summary:string;audience:Audience;indexable:number;allowMatching:number;acceptanceMode:"manual"|"full_autopilot";coarseLocation:string|null;locationMapOptIn:number;timezone:string|null;publishedAt:number|null};
type FieldRow={key:string;valueJson:string;audience:Audience;allowMatching:number;sourceStatus:string;provenance:string};
type ProjectSummaryRow={id:string;slug:string;title:string;summary:string;stage:string;status:string;audience:Audience;indexable:number};
type ProjectDetailRow={id:string;ownerUserId:string;slug:string;title:string;summary:string;audience:Audience;allow_matching:number;status:string;stage:string;indexable:number;handle:string;ownerDisplayName:string};

export function normalizeHandle(value: string) { const result = value.trim().toLowerCase(); if (!/^[a-z0-9_]{3,32}$/.test(result)) throw new Error("invalid_handle"); return result; }
export function normalizeSlug(value: string) { const result = value.trim().toLowerCase(); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 72) throw new Error("invalid_slug"); return result; }
function bounded(value: string, maximum: number, code: string) { const result = value.trim(); if (!result || result.length > maximum) throw new Error(code); return result; }
function assertAudience(value: string): asserts value is Audience { if (!AUDIENCES.includes(value as Audience)) throw new Error("invalid_audience"); }
function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }

export async function saveProfile(db: D1Database, userId: string, input: ProfileInput, options: { publish?: boolean; preserveExistingDetails?: boolean } = {}) {
  const handle = normalizeHandle(input.handle); assertAudience(input.audience);
  const displayName = bounded(input.displayName, 80, "invalid_display_name");
  const summary = bounded(input.summary, 1200, "invalid_summary");
  const now = Date.now(); const existingProfile=await db.prepare("SELECT id FROM profiles WHERE user_id=?").bind(userId).first<{id:string}>();const profileId = existingProfile?.id??`profile_${userId}`;
  const statements = [
    db.prepare("INSERT OR IGNORE INTO users (id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
    db.prepare("INSERT INTO handles (user_id,handle,normalized_handle,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle").bind(userId, handle, handle, now),
    db.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,coarse_location,location_map_opt_in,timezone,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,portfolio_links_json=CASE WHEN ? THEN profiles.portfolio_links_json ELSE excluded.portfolio_links_json END,audience=excluded.audience,allow_matching=excluded.allow_matching,acceptance_mode=excluded.acceptance_mode,indexable=excluded.indexable,coarse_location=excluded.coarse_location,location_map_opt_in=CASE WHEN ? THEN excluded.location_map_opt_in ELSE profiles.location_map_opt_in END,timezone=excluded.timezone,published_at=excluded.published_at,updated_at=excluded.updated_at").bind(profileId,userId,displayName,summary,input.projectOrInterest?.trim()??"",JSON.stringify(input.portfolioLinks??[]),input.audience,input.allowMatching?1:0,input.acceptanceMode,input.indexable?1:0,input.coarseLocation?.trim()||null,input.locationMapOptIn?1:0,input.timezone?.trim()||null,options.publish === false || input.audience === "private" ? null : now,now,now,options.preserveExistingDetails?1:0,input.locationMapOptIn===undefined?0:1),
  ];
  if (!options.preserveExistingDetails) {
    statements.push(db.prepare("DELETE FROM profile_fields WHERE profile_id=?").bind(profileId));
    statements.push(db.prepare("DELETE FROM profile_statistics WHERE profile_id=?").bind(profileId));
  }
  for (const field of input.fields) {
    if (!PROFILE_FIELD_KEYS.includes(field.key)) throw new Error("invalid_profile_field"); assertAudience(field.audience);
    const json = JSON.stringify(field.value); if (json.length > 4000) throw new Error("profile_field_too_large");
    statements.push(db.prepare("INSERT INTO profile_fields (profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(profile_id,field_key) DO UPDATE SET value_json=excluded.value_json,audience=excluded.audience,allow_matching=excluded.allow_matching,source_status=excluded.source_status,provenance=excluded.provenance,updated_at=excluded.updated_at").bind(profileId,field.key,json,field.audience,field.allowMatching?1:0,field.sourceStatus??"confirmed",field.provenance??"self_reported",now));
  }
  for(const statistic of input.statistics??[]){if(!/^[a-z][a-z0-9_]{1,39}$/.test(statistic.key))throw new Error("invalid_statistic");assertAudience(statistic.audience);statements.push(db.prepare("INSERT INTO profile_statistics(profile_id,stat_key,label,value,provenance,audience,updated_at)VALUES(?,?,?,?,?,?,?)").bind(profileId,statistic.key,bounded(statistic.label,50,"invalid_statistic"),bounded(statistic.value,80,"invalid_statistic"),statistic.provenance,statistic.audience,now))}
  statements.push(...matchingInvalidationStatements(db,userId,now));
  const results = await db.batch(statements); if (results.some((result) => !result.success)) throw new Error("profile_save_failed");
  return { profileId, handle };
}

export async function publishProfile(db: D1Database, userId: string) {
  const now = Date.now();
  const result = await db.prepare("UPDATE profiles SET published_at=?,updated_at=? WHERE user_id=? AND published_at IS NULL AND EXISTS (SELECT 1 FROM handles WHERE handles.user_id=profiles.user_id)").bind(now,now,userId).run();
  if (!result.meta?.changes) {
    const existing = await db.prepare("SELECT published_at AS publishedAt FROM profiles WHERE user_id=?").bind(userId).first<{publishedAt:number|null}>();
    if (!existing) throw new Error("profile_not_found");
  }
}

export async function getProfileByHandle(db: D1Database, handleInput: string, viewerId: Viewer) {
  const handle = normalizeHandle(handleInput);
  const profile = await db.prepare(`SELECT p.id,p.user_id AS userId,h.handle,p.display_name AS displayName,p.summary,p.audience,p.indexable,p.allow_matching AS allowMatching,p.acceptance_mode AS acceptanceMode,p.coarse_location AS coarseLocation,p.location_map_opt_in AS locationMapOptIn,p.timezone,p.published_at AS publishedAt FROM profiles p JOIN handles h ON h.user_id=p.user_id WHERE h.normalized_handle=? AND (p.user_id=? OR p.published_at IS NOT NULL) AND ${audiencePredicate("p") } LIMIT 1`).bind(handle,viewerId??"",...audienceBindings(viewerId)).first<ProfileRow>();
  if (!profile) return null;
  const fields = (await db.prepare(`SELECT field_key AS key,value_json AS valueJson,audience,allow_matching AS allowMatching,source_status AS sourceStatus,provenance FROM profile_fields f WHERE f.profile_id=? AND ${audiencePredicate("f", "(SELECT user_id FROM profiles WHERE id=f.profile_id)")} ORDER BY field_key`).bind(profile.id,...audienceBindings(viewerId)).all<FieldRow>()).results.map(({valueJson,...row}) => ({ ...row, value: JSON.parse(valueJson) as unknown, allowMatching: Boolean(row.allowMatching) }));
  const projects = (await db.prepare(`SELECT id,slug,title,summary,stage,status,audience,indexable FROM projects x WHERE x.owner_user_id=? AND x.status='active' AND ${audiencePredicate("x", "owner_user_id")} ORDER BY updated_at DESC`).bind(profile.userId,...audienceBindings(viewerId)).all<ProjectSummaryRow>()).results;
  const statistics=(await db.prepare(`SELECT stat_key AS key,label,value,provenance,audience FROM profile_statistics s WHERE s.profile_id=? AND ${audienceWithoutCohort("s","(SELECT user_id FROM profiles WHERE id=s.profile_id)")} ORDER BY stat_key`).bind(profile.id,...audienceBindings(viewerId).filter((_,index)=>index!==3)).all<{key:string;label:string;value:string;provenance:string;audience:Audience}>()).results;
  const workSignals=(await db.prepare(`SELECT w.id,w.free_text_summary AS summary,w.audience,w.expires_at AS expiresAt FROM work_signals w WHERE w.user_id=? AND w.approved_at IS NOT NULL AND w.revoked_at IS NULL AND w.expires_at>? AND ${audiencePredicate("w")} ORDER BY w.updated_at DESC LIMIT 20`).bind(profile.userId,Date.now(),...audienceBindings(viewerId)).all<{id:string;summary:string;audience:Audience;expiresAt:number}>()).results;
  return { ...profile, indexable: Boolean(profile.indexable), locationMapOptIn: Boolean(profile.locationMapOptIn), allowMatching: Boolean(profile.allowMatching), fields, statistics, projects, workSignals };
}

export async function saveProject(db: D1Database, userId: string, input: ProjectInput, existingSlug?: string) {
  const slug = normalizeSlug(input.slug); assertAudience(input.audience); const now = Date.now();
  bounded(input.title, 120, "invalid_title"); bounded(input.summary, 1200, "invalid_summary"); bounded(input.stage, 60, "invalid_stage");
  for (const link of input.links ?? []) { bounded(link.label, 40, "invalid_link_label"); const url = new URL(link.url); if (!['https:','http:'].includes(url.protocol)) throw new Error("invalid_link_url"); }
  const current = existingSlug ? await db.prepare("SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted'").bind(normalizeSlug(existingSlug), userId).first<{id:string}>() : null;
  const id = current?.id ?? uid("project");
  const statements = [db.prepare("INSERT OR IGNORE INTO users (id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId,now,now), db.prepare("INSERT INTO projects (id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,summary=excluded.summary,audience=excluded.audience,allow_matching=excluded.allow_matching,status=excluded.status,stage=excluded.stage,indexable=excluded.indexable,published_at=excluded.published_at,deleted_at=NULL,updated_at=excluded.updated_at").bind(id,userId,slug,input.title.trim(),input.summary.trim(),input.audience,input.allowMatching?1:0,input.status,input.stage.trim(),input.indexable?1:0,input.status==='active'?now:null,now,now), db.prepare("DELETE FROM project_links WHERE project_id=?").bind(id), db.prepare("DELETE FROM project_taxonomy_items WHERE project_id=?").bind(id)];
  (input.links??[]).forEach((link,index)=>statements.push(db.prepare("INSERT INTO project_links (id,project_id,label,url,position,created_at) VALUES (?,?,?,?,?,?)").bind(uid("link"),id,link.label.trim(),link.url,index,now)));
  (input.taxonomy??[]).forEach((item)=>statements.push(db.prepare("INSERT INTO project_taxonomy_items (project_id,kind,taxonomy_item_id,created_at) VALUES (?,?,?,?)").bind(id,item.kind,item.id,now)));
  statements.push(...matchingInvalidationStatements(db,userId,now));
  const results=await db.batch(statements); if(results.some((result)=>!result.success)) throw new Error("project_save_failed"); return {id,slug};
}

export async function getProjectBySlug(db: D1Database, slugInput: string, viewerId: Viewer) {
  const slug=normalizeSlug(slugInput); const row=await db.prepare(`SELECT x.id,x.owner_user_id AS ownerUserId,x.slug,x.title,x.summary,x.audience,x.allow_matching,x.status,x.stage,x.indexable,h.handle,p.display_name AS ownerDisplayName FROM projects x JOIN handles h ON h.user_id=x.owner_user_id JOIN profiles p ON p.user_id=x.owner_user_id WHERE x.slug=? AND x.status<>'deleted' AND ((x.owner_user_id=? OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id=x.id AND pc.user_id=? AND pc.approved_at IS NOT NULL)) OR (x.status='active' AND ${audiencePredicate("x", "owner_user_id")})) LIMIT 1`).bind(slug,viewerId??"",viewerId??"",...audienceBindings(viewerId)).first<ProjectDetailRow>();
  if(!row)return null; const links=(await db.prepare("SELECT label,url FROM project_links WHERE project_id=? ORDER BY position").bind(row.id).all<{label:string;url:string}>()).results; const taxonomy=(await db.prepare("SELECT kind,taxonomy_item_id AS id FROM project_taxonomy_items WHERE project_id=? ORDER BY kind,taxonomy_item_id").bind(row.id).all<{kind:string;id:string}>()).results; const updates=(await db.prepare("SELECT id,body,created_at AS createdAt FROM project_updates WHERE project_id=? AND (author_user_id=? OR audience='public' OR (audience='signed_in' AND ?<>'')) ORDER BY created_at DESC LIMIT 20").bind(row.id,viewerId??'',viewerId??'').all<{id:string;body:string;createdAt:number}>()).results; return {...row,indexable:Boolean(row.indexable),allow_matching:Boolean(row.allow_matching),links,taxonomy,updates};
}

export async function changeProjectLifecycle(db:D1Database,userId:string,slugInput:string,action:"archive"|"restore"|"delete") { const slug=normalizeSlug(slugInput); const now=Date.now(); const status=action==='archive'?'archived':action==='restore'?'active':'deleted'; const results=await db.batch([db.prepare("UPDATE projects SET status=?,published_at=CASE WHEN ?='active' THEN COALESCE(published_at,?) ELSE published_at END,deleted_at=CASE WHEN ?='deleted' THEN ? ELSE NULL END,updated_at=? WHERE slug=? AND owner_user_id=? AND status<>'deleted'").bind(status,status,now,status,now,now,slug,userId),...matchingInvalidationStatements(db,userId,now)]); if(!results[0].meta?.changes)throw new Error("project_not_found"); }

function matchingInvalidationStatements(db:D1Database,userId:string,now:number):D1PreparedStatement[]{return [
  db.prepare("UPDATE builder_match_index SET version=version+1,topics_json='[]',tools_json='[]',domains_json='[]',stages_json='[]',intents_json='[]',updated_at=? WHERE user_id=?").bind(now,userId),
  db.prepare("DELETE FROM pair_scores WHERE user_a_id=? OR user_b_id=?").bind(userId,userId),
  db.prepare("DELETE FROM candidate_batches WHERE user_id=? OR EXISTS (SELECT 1 FROM json_each(candidate_ids_json) WHERE value=?)").bind(userId,userId),
  db.prepare("UPDATE match_proposals SET state='invalidated',terminal_at=? WHERE state='pending' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?)").bind(now,userId,userId),
  db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE read_at IS NULL AND kind IN ('match_candidate','match_proposal','match_ready','candidate_shortlist') AND (user_id=? OR (json_valid(payload_json) AND (json_extract(payload_json,'$.candidateUserId')=? OR json_extract(payload_json,'$.userId')=?)))").bind(now,userId,userId,userId),
];}

function audienceBindings(viewerId: Viewer) { const value=viewerId??""; return [value,value,value,value,value,value,value,value] as const; }
function audienceWithoutCohort(alias:string,owner:string){return `(${owner}=? OR (NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=${owner} AND b.blocked_user_id=?) OR (b.blocked_user_id=${owner} AND b.blocker_user_id=?))) AND (${alias}.audience='public' OR (${alias}.audience='signed_in' AND ?<>'') OR (${alias}.audience='suggested_connections' AND EXISTS (SELECT 1 FROM match_pairs mp WHERE (mp.user_a_id=${owner} AND mp.user_b_id=?) OR (mp.user_b_id=${owner} AND mp.user_a_id=?))) OR (${alias}.audience='mutual_connections' AND EXISTS (SELECT 1 FROM connection_sides cs1 JOIN connection_sides cs2 ON cs2.connection_id=cs1.connection_id JOIN connections c ON c.id=cs1.connection_id WHERE cs1.user_id=${owner} AND cs2.user_id=? AND c.state='active')))))`}
function audiencePredicate(alias:string, ownerColumn="user_id") { const owner=ownerColumn.startsWith("(")?ownerColumn:`${alias}.${ownerColumn}`; return `(${owner}=? OR (NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=${owner} AND b.blocked_user_id=?) OR (b.blocked_user_id=${owner} AND b.blocker_user_id=?))) AND (${alias}.cohort_scope_id IS NULL OR EXISTS (SELECT 1 FROM cohort_memberships cm1 JOIN cohort_memberships cm2 ON cm2.cohort_id=cm1.cohort_id WHERE cm1.cohort_id=${alias}.cohort_scope_id AND cm1.user_id=? AND cm2.user_id=${owner} AND cm1.status='active' AND cm2.status='active')) AND (${alias}.audience='public' OR (${alias}.audience='signed_in' AND ?<>'') OR (${alias}.audience='suggested_connections' AND EXISTS (SELECT 1 FROM match_pairs mp WHERE (mp.user_a_id=${owner} AND mp.user_b_id=?) OR (mp.user_b_id=${owner} AND mp.user_a_id=?))) OR (${alias}.audience='mutual_connections' AND EXISTS (SELECT 1 FROM connection_sides cs1 JOIN connection_sides cs2 ON cs2.connection_id=cs1.connection_id JOIN connections c ON c.id=cs1.connection_id WHERE cs1.user_id=${owner} AND cs2.user_id=? AND c.state='active')))))`; }
