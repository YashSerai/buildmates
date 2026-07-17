"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Collaborator = { userId: string; displayName: string; handle: string; role: string; approvedAt: number | null };

export function ProjectControls({ slug, status, isOwner, canEdit }: { slug: string; status: string; isOwner: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/projects/${encodeURIComponent(slug)}`;
  const loadCollaborators = useCallback(async () => {
    if (!canEdit) return;
    const response = await fetch(`${endpoint}/collaborators`, { cache: "no-store" });
    if (response.ok) setCollaborators(((await response.json()) as { collaborators: Collaborator[] }).collaborators);
  }, [canEdit, endpoint]);
  useEffect(() => { void Promise.resolve().then(loadCollaborators); }, [loadCollaborators]);
  async function postUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch(`${endpoint}/updates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: form.get("body"), audience: form.get("audience") }) });
    setNotice(response.ok ? "Project update published." : "Update could not be published.");
    if (response.ok) { event.currentTarget.reset(); router.refresh(); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch(`${endpoint}/collaborators`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: form.get("handle"), role: form.get("role") }) });
    setNotice(response.ok ? "Collaboration invitation sent." : "That builder could not be invited.");
    if (response.ok) { event.currentTarget.reset(); await loadCollaborators(); }
  }
  async function lifecycle(action: "archive" | "restore" | "delete") {
    if (action === "delete" && !window.confirm("Delete this project? This removes it from your profile, shared links, and matching.")) return;
    const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!response.ok) { setNotice("Project status could not be changed."); return; }
    if (action === "delete") router.push("/profile");
    else router.refresh();
  }
  async function collaboratorAction(userId: string, action: "remove" | "transfer") {
    if (!window.confirm(action === "transfer" ? "Transfer project ownership to this collaborator?" : "Remove this collaborator?")) return;
    const response = await fetch(action === "transfer" ? `${endpoint}/collaborators` : `${endpoint}/collaborators?userId=${encodeURIComponent(userId)}`, { method: action === "transfer" ? "PUT" : "DELETE", headers: { "content-type": "application/json" }, body: action === "transfer" ? JSON.stringify({ newOwnerUserId: userId }) : undefined });
    setNotice(response.ok ? (action === "transfer" ? "Ownership transferred." : "Collaborator removed.") : "That collaborator change could not be saved.");
    if (response.ok) { await loadCollaborators(); router.refresh(); }
  }

  if (!canEdit) return null;
  return <section aria-labelledby="project-controls"><h2 id="project-controls">Project controls</h2>
    <form onSubmit={postUpdate}><label>Share an update<textarea name="body" maxLength={2000} rows={4} required /></label><label>Who can see it?<select name="audience"><option value="public">Public</option><option value="signed_in">Signed-in builders</option><option value="mutual_connections">Mutual connections</option><option value="private">Only collaborators</option></select></label><button>Publish update</button></form>
    {isOwner && <><p><a href={`/projects/${encodeURIComponent(slug)}/edit`}>Edit project details</a></p><form onSubmit={invite}><label>Invite collaborator by handle<input name="handle" placeholder="builder-handle" required /></label><label>Role<select name="role"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button>Invite</button></form>{collaborators.length > 0 && <ul>{collaborators.map((collaborator) => <li key={collaborator.userId}><strong>{collaborator.displayName}</strong> @{collaborator.handle} · {collaborator.approvedAt ? collaborator.role : "invited"} <button onClick={() => void collaboratorAction(collaborator.userId, "remove")}>Remove</button>{collaborator.approvedAt && <button onClick={() => void collaboratorAction(collaborator.userId, "transfer")}>Transfer ownership</button>}</li>)}</ul>}<div>{status === "archived" ? <button onClick={() => void lifecycle("restore")}>Restore project</button> : <button onClick={() => void lifecycle("archive")}>Archive project</button>}<button onClick={() => void lifecycle("delete")}>Delete project</button></div></>}
    <p role="status">{notice}</p>
  </section>;
}
