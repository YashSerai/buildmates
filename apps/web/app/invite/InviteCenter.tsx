"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./invite.module.css";

type Invite = { id: string; kind: string; targetId: string | null; maximumUses: number; useCount: number; expiresAt: number; revokedAt: number | null; createdAt: number };
type Project = { id?: string; slug: string; title: string; status: string };

export function InviteCenter({ initialWatch }: { initialWatch: boolean }) {
  const [url, setUrl] = useState("");
  const [watching, setWatching] = useState(initialWatch);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const load = useCallback(async () => {
    const [inviteResponse, projectResponse] = await Promise.all([fetch("/api/invites", { cache: "no-store" }), fetch("/api/projects", { cache: "no-store" })]);
    if (inviteResponse.ok) setInvites(((await inviteResponse.json()) as { invites: Invite[] }).invites); else setError("Invitation history could not be loaded. Try again.");
    if (projectResponse.ok) setProjects(((await projectResponse.json()) as { projects: Project[] }).projects.filter((project) => project.status === "active")); else setError("Your projects could not be loaded. Try again.");
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function create(payload: object) {
    setError("");
    setNotice("");
    setBusy("create");
    try {
      const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { token?: string; error?: string };
      if (!response.ok || !body.token) { setError(userFacingError(body.error, "Could not create the invitation.")); return; }
      setUrl(`${location.origin}/i/${body.token}`);
      await load();
    } catch {
      setError("Buildmates could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }
  async function personal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await create({ kind: "personal", maximumUses: 1 });
  }
  async function card(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const slug = String(form.get("project"));
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) { setError("Choose an active project."); return; }
    const project = await response.json() as { id: string };
    await create({ kind: "connection_card", targetId: project.id, maximumUses: 1 });
  }
  async function toggle() {
    setBusy("watch");
    const enabled = !watching;
    try {
      const response = await fetch("/api/watches/relevant-builders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) });
      if (response.ok) { setWatching(enabled); setNotice(enabled ? "Included in your scheduled Work Pulse." : "Removed from your scheduled Work Pulse."); } else setError("The watch could not be changed.");
    } catch {
      setError("Buildmates could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }
  async function revoke(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) await load(); else setError("That invitation could not be revoked.");
    } catch {
      setError("Buildmates could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <section className={styles.panel}><h2>Invite someone you know</h2><p>Buildmates knows the invitation comes from your signed-in profile. Send this one-time link to one person; they will see only what you chose to share.</p><form onSubmit={personal}><button disabled={busy !== null}>{busy === "create" ? "Creating…" : "Create invitation"}</button></form></section>
    <section className={styles.panel}><h2>Invite through a project</h2><p>Center the invitation on a project, so they know what sparked it.</p>{projects.length ? <form onSubmit={card}><label>Project<select name="project">{projects.map((project) => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select></label><button disabled={busy !== null}>{busy === "create" ? "Creating…" : "Create project invitation"}</button></form> : <p>Share a project on your profile to create this invitation.</p>}</section>
    {url && <section className={styles.panel}><h2>New share link</h2><label>Share link<input readOnly value={url} onFocus={(event) => event.currentTarget.select()} /></label><button onClick={() => void navigator.clipboard.writeText(url).then(() => setNotice("Link copied.")).catch(() => setError("Copy was blocked. Select the share link and copy it manually."))}>Copy link</button></section>}
    <section className={styles.toggle}><h2>Let Codex keep looking</h2><p>Codex will mention promising new builders during your next scheduled Work Pulse.</p><button disabled={busy !== null} aria-pressed={watching} onClick={toggle}>{busy === "watch" ? "Updating…" : watching ? "Included in your Work Pulse" : "Notify me in Work Pulse"}</button></section>
    {invites.length > 0 && <section className={styles.panel}><h2>Invitation history</h2><ul>{invites.map((invite) => <li key={invite.id}><span>{inviteKindLabel(invite.kind)} · {invite.useCount > 0 ? "Used" : "Unused"} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>{invite.revokedAt ? <strong>Revoked</strong> : invite.useCount > 0 ? <strong>Completed</strong> : <button disabled={busy !== null} onClick={() => void revoke(invite.id)}>{busy === invite.id ? "Revoking…" : "Revoke"}</button>}</li>)}</ul></section>}
    {notice && <p className={styles.status} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}

function inviteKindLabel(kind: string) { return ({personal:"Personal invitation",builder:"Profile invitation",connection_card:"Project connection card"} as Record<string,string>)[kind] ?? "Buildmates invitation"; }
