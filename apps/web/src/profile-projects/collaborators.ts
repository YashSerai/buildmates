import { normalizeSlug } from "./service";

type DB = D1Database;

export async function listProjectCollaborators(DB: DB, actorId: string, slugInput: string) {
  return (await listProjectCollaboratorsPage(DB, actorId, slugInput, null, 100)).value;
}

export async function listProjectCollaboratorsPage(DB: DB, actorId: string, slugInput: string, after: string|null, limit=50): Promise<{value:{projectId:string;ownerUserId:string;collaborators:unknown[]};nextCursor:string|null}> {
  const slug = normalizeSlug(slugInput);
  const project = await DB.prepare("SELECT id,owner_user_id AS ownerUserId FROM projects WHERE slug=? AND status<>'deleted' LIMIT 1").bind(slug).first<{ id: string; ownerUserId: string }>();
  if (!project) throw new Error("project_not_found");
  const allowed = project.ownerUserId === actorId || await DB.prepare("SELECT 1 AS ok FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL").bind(project.id, actorId).first();
  if (!allowed) throw new Error("project_not_found");
  const bounded=Math.max(1,Math.min(100,limit)),cursor=parseCollaboratorCursor(after);
  const rows = await DB.prepare(`SELECT collaborator.user_id AS userId,profile.display_name AS displayName,handle.handle,collaborator.role,collaborator.approved_at AS approvedAt,
      CASE WHEN collaborator.approved_at IS NULL THEN 1 ELSE 0 END AS pendingOrder
    FROM project_collaborators collaborator JOIN profiles profile ON profile.user_id=collaborator.user_id JOIN handles handle ON handle.user_id=collaborator.user_id
    WHERE collaborator.project_id=? AND (pendingOrder>? OR (pendingOrder=? AND (profile.display_name>? OR (profile.display_name=? AND collaborator.user_id>?))))
    ORDER BY pendingOrder,profile.display_name,collaborator.user_id LIMIT ?`).bind(project.id,cursor.pending,cursor.pending,cursor.name,cursor.name,cursor.id,bounded+1).all<{userId:string;displayName:string;handle:string;role:string;approvedAt:number|null;pendingOrder:number}>();
  const page=rows.results.slice(0,bounded), collaborators=page.map((row)=>({userId:row.userId,displayName:row.displayName,handle:row.handle,role:row.role,approvedAt:row.approvedAt}));
  return { value:{ projectId: project.id, ownerUserId: project.ownerUserId, collaborators }, nextCursor:rows.results.length>bounded&&page.length?`pc:${page[page.length-1]!.pendingOrder}:${encodeURIComponent(page[page.length-1]!.displayName)}:${encodeURIComponent(page[page.length-1]!.userId)}`:null };
}

function parseCollaboratorCursor(value:string|null){if(!value)return{pending:-1,name:"",id:""};if(!value.startsWith("pc:"))throw new Error("invalid_collaborator_cursor");const parts=value.split(":");const pending=Number(parts[1]);if(!Number.isInteger(pending)||pending<0||pending>1||!parts[2]||!parts[3])throw new Error("invalid_collaborator_cursor");let name="",id="";try{name=decodeURIComponent(parts[2]!);id=decodeURIComponent(parts.slice(3).join(":"))}catch{throw new Error("invalid_collaborator_cursor")}if(!id)throw new Error("invalid_collaborator_cursor");return{pending,name,id}}

export async function inviteProjectCollaborator(DB: DB, input: { actorId: string; slug: string; handle: string; role: "viewer" | "editor"; now: number }) {
  const slug = normalizeSlug(input.slug);
  const project = await DB.prepare("SELECT id,owner_user_id AS ownerUserId,title FROM projects WHERE slug=? AND status<>'deleted' LIMIT 1").bind(slug).first<{ id: string; ownerUserId: string; title: string }>();
  if (!project || project.ownerUserId !== input.actorId) throw new Error("project_not_found");
  const handle = input.handle.trim().replace(/^@/, "").toLowerCase();
  const target = await DB.prepare("SELECT handles.user_id AS userId FROM handles JOIN users ON users.id=handles.user_id AND users.status='active' WHERE handles.normalized_handle=? LIMIT 1").bind(handle).first<{ userId: string }>();
  if (!target || target.userId === input.actorId) throw new Error("collaborator_not_found");
  const results = await DB.batch([
    DB.prepare("INSERT INTO project_collaborators (project_id,user_id,role,approved_at) SELECT ?,?,?,NULL WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND status='active') ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,approved_at=project_collaborators.approved_at").bind(project.id, target.userId, input.role, target.userId),
    DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'project_collaboration_invite','immediate',?,? WHERE EXISTS (SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NULL) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,created_at=excluded.created_at").bind(`project-invite:${project.id}:${target.userId}`, target.userId, JSON.stringify({ projectId: project.id, slug, projectTitle: project.title }), input.now, project.id, target.userId),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) throw new Error("collaborator_not_found");
  return { slug, targetUserId: target.userId, role: input.role, invited: true };
}

export async function respondProjectCollaboration(DB: DB, input: { actorId: string; slug: string; accept: boolean; now: number }) {
  const slug = normalizeSlug(input.slug);
  const result = input.accept
    ? await DB.prepare("UPDATE project_collaborators SET approved_at=? WHERE project_id=(SELECT id FROM projects WHERE slug=? AND status<>'deleted') AND user_id=? AND approved_at IS NULL").bind(input.now, slug, input.actorId).run()
    : await DB.prepare("DELETE FROM project_collaborators WHERE project_id=(SELECT id FROM projects WHERE slug=? AND status<>'deleted') AND user_id=? AND approved_at IS NULL").bind(slug, input.actorId).run();
  if (Number(result.meta?.changes ?? 0) !== 1) throw new Error("collaboration_invite_not_found");
  return { slug, accepted: input.accept };
}

export async function removeProjectCollaborator(DB: DB, input: { actorId: string; slug: string; targetUserId: string }) {
  const slug = normalizeSlug(input.slug);
  const result = await DB.prepare("DELETE FROM project_collaborators WHERE project_id=(SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted') AND user_id=?")
    .bind(slug, input.actorId, input.targetUserId).run();
  if (Number(result.meta?.changes ?? 0) !== 1) throw new Error("collaborator_not_found");
  return { slug, targetUserId: input.targetUserId, removed: true };
}

export async function transferProjectOwnership(DB: DB, input: { actorId: string; slug: string; targetUserId: string; now: number }) {
  const slug = normalizeSlug(input.slug);
  const project = await DB.prepare("SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted' LIMIT 1").bind(slug, input.actorId).first<{ id: string }>();
  if (!project || input.targetUserId === input.actorId) throw new Error("project_not_found");
  const accepted = await DB.prepare("SELECT 1 AS ok FROM project_collaborators collaborator JOIN users target ON target.id=collaborator.user_id AND target.status='active' WHERE collaborator.project_id=? AND collaborator.user_id=? AND collaborator.approved_at IS NOT NULL").bind(project.id, input.targetUserId).first();
  if (!accepted) throw new Error("accepted_collaborator_required");
  const transfer = await DB.batch([
    DB.prepare("UPDATE projects SET owner_user_id=?,updated_at=? WHERE id=? AND owner_user_id=? AND EXISTS (SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL) AND EXISTS (SELECT 1 FROM users WHERE id=? AND status='active')").bind(input.targetUserId, input.now, project.id, input.actorId, project.id, input.targetUserId, input.targetUserId),
    DB.prepare("INSERT INTO project_collaborators(project_id,user_id,role,approved_at) SELECT ?,?,'editor',? WHERE EXISTS (SELECT 1 FROM projects WHERE id=? AND owner_user_id=?) AND EXISTS (SELECT 1 FROM users WHERE id=? AND status='active') AND EXISTS (SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL) ON CONFLICT(project_id,user_id) DO UPDATE SET role='editor',approved_at=excluded.approved_at").bind(project.id, input.actorId, input.now, project.id, input.targetUserId, input.targetUserId, project.id, input.targetUserId),
    DB.prepare("DELETE FROM project_collaborators WHERE project_id=? AND user_id=? AND EXISTS (SELECT 1 FROM projects WHERE id=? AND owner_user_id=?)").bind(project.id, input.targetUserId, project.id, input.targetUserId),
  ]);
  if (Number(transfer[0]?.meta?.changes ?? 0) !== 1) throw new Error("ownership_transfer_failed");
  return { slug, ownerUserId: input.targetUserId, transferred: true };
}
