"use client";

import { FormEvent, useState } from "react";
import styles from "./cohorts.module.css";

type Member = { userId?: string; handle: string; displayName: string; role: string };
type PendingMember = { userId: string; handle: string | null; displayName: string };

export function CohortAdmin({ cohort, members, pendingMembers }: { cohort: { id: string; name: string; description: string; visibility: string; viewerRole: string | null }; members: Member[]; pendingMembers: PendingMember[] }) {
  const [notice, setNotice] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(payload: object) {
    setBusy(true); setNotice("");
    const response = await fetch(`/api/cohorts/${encodeURIComponent(cohort.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { setNotice(data.error ?? "The cohort could not be updated."); return false; }
    setNotice("Cohort updated."); return true;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await update({ name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), visibility: String(form.get("visibility") ?? "request") })) window.location.reload();
  }

  async function memberAction(userId: string, action: "approve" | "decline" | "remove" | "promote" | "demote" | "transfer") {
    if ((action === "remove" || action === "transfer") && !window.confirm(action === "transfer" ? "Transfer cohort ownership to this member? Your role becomes admin." : "Remove this member from the cohort?")) return;
    setBusy(true); setNotice("");
    const response = await fetch(`/api/cohorts/${encodeURIComponent(cohort.id)}/members/${encodeURIComponent(userId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { setNotice(data.error ?? "The membership could not be updated."); return; }
    window.location.reload();
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const recipientHandle = String(form.get("recipientHandle") ?? "").trim();
    setBusy(true); setNotice("");
    const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "cohort_admin", targetId: cohort.id, recipientHandle: recipientHandle || undefined, maximumUses: recipientHandle ? 1 : 25 }) });
    const data = await response.json().catch(() => ({})) as { token?: string; error?: string };
    setBusy(false);
    if (!response.ok || !data.token) { setNotice(data.error ?? "The invite could not be created."); return; }
    setInviteUrl(`${window.location.origin}/i/${data.token}`);
  }

  return <section className={styles.admin} aria-labelledby="cohort-admin-title">
    <div><p className={styles.meta}>Admin controls</p><h2 id="cohort-admin-title">Run the cohort</h2><p>Membership and visibility are enforced by the server. Owner-only actions are labelled separately.</p></div>
    <form className={styles.adminForm} onSubmit={save}><label>Name<input name="name" defaultValue={cohort.name} required maxLength={100} /></label><label>Description<textarea name="description" defaultValue={cohort.description} required maxLength={800} /></label><label>Access<select name="visibility" defaultValue={cohort.visibility}><option value="public">Open to join</option><option value="request">Request to join</option><option value="invite">Invite only</option><option value="private">Private</option></select></label><button disabled={busy}>Save cohort</button></form>
    <div className={styles.adminGrid}><section><h3>Join requests</h3>{pendingMembers.length ? pendingMembers.map((member) => <article className={styles.adminRow} key={member.userId}><span>{member.displayName}{member.handle ? ` · @${member.handle}` : ""}</span><div><button disabled={busy} onClick={() => void memberAction(member.userId, "approve")}>Approve</button><button disabled={busy} onClick={() => void memberAction(member.userId, "decline")}>Decline</button></div></article>) : <p>No pending requests.</p>}</section><section><h3>Active members</h3>{members.filter((member) => member.userId).map((member) => <article className={styles.adminRow} key={member.userId}><span>{member.displayName} · {member.role}</span>{member.role !== "owner" && <div>{cohort.viewerRole === "owner" && <button disabled={busy} onClick={() => void memberAction(member.userId!, member.role === "admin" ? "demote" : "promote")}>{member.role === "admin" ? "Make member" : "Make admin"}</button>}<button disabled={busy} onClick={() => void memberAction(member.userId!, "remove")}>Remove</button>{cohort.viewerRole === "owner" && <button disabled={busy} onClick={() => void memberAction(member.userId!, "transfer")}>Transfer ownership</button>}</div>}</article>)}</section></div>
    <form className={styles.inviteForm} onSubmit={createInvite}><label>Invite one builder by handle (optional)<input name="recipientHandle" placeholder="builder-handle" /></label><button disabled={busy}>Create invite link</button>{inviteUrl && <label>New invite<input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /></label>}</form>
    {cohort.viewerRole === "owner" && <div className={styles.ownerActions}><button disabled={busy} onClick={() => window.confirm("Archive this cohort? Members keep their history, but the cohort closes to activity.") && void update({ status: "archived" }).then((ok) => ok && window.location.assign("/cohorts"))}>Archive cohort</button><button disabled={busy} onClick={() => window.confirm("Delete this cohort? This removes it from discovery and cannot be undone from the site.") && void update({ status: "deleted" }).then((ok) => ok && window.location.assign("/cohorts"))}>Delete cohort</button></div>}
    <p className={styles.adminNotice} role="status">{notice}</p>
  </section>;
}
