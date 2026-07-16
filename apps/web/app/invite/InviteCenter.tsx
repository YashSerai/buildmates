"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./invite.module.css";

type Invite = { id: string; kind: string; targetId: string | null; maximumUses: number; useCount: number; expiresAt: number; revokedAt: number | null; createdAt: number };
type Project = { id?: string; slug: string; title: string; status: string };

export function InviteCenter({ initialWatch }: { initialWatch: boolean }) {
  const [url, setUrl] = useState("");
  const [watching, setWatching] = useState(initialWatch);
  const [error, setError] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const load = useCallback(async () => {
    const [inviteResponse, projectResponse] = await Promise.all([fetch("/api/invites", { cache: "no-store" }), fetch("/api/projects", { cache: "no-store" })]);
    if (inviteResponse.ok) setInvites(((await inviteResponse.json()) as { invites: Invite[] }).invites);
    if (projectResponse.ok) setProjects(((await projectResponse.json()) as { projects: Project[] }).projects.filter((project) => project.status === "active"));
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function create(payload: object) {
    setError("");
    const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { token?: string; error?: string };
    if (!response.ok || !body.token) { setError(body.error ?? "Could not create invite"); return; }
    setUrl(`${location.origin}/i/${body.token}`);
    await load();
  }
  async function personal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await create({ kind: "personal", recipientHandle: String(form.get("recipientHandle") ?? "").trim() || undefined, maximumUses: 20 });
  }
  async function card(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const slug = String(form.get("project"));
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) { setError("Choose an active project."); return; }
    const project = await response.json() as { id: string };
    await create({ kind: "connection_card", targetId: project.id, recipientHandle: String(form.get("recipientHandle") ?? "").trim() || undefined, maximumUses: 20 });
  }
  async function toggle() {
    const enabled = !watching;
    const response = await fetch("/api/watches/relevant-builders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) });
    if (response.ok) setWatching(enabled); else setError("The watch could not be changed.");
  }
  async function revoke(id: string) {
    const response = await fetch(`/api/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await load(); else setError("That invitation could not be revoked.");
  }

  return <>
    <section className={styles.panel}><h2>Invite a builder whose work you follow</h2><p>The link grants no access to private profile fields or connected apps. Name a recipient to make it single-use, or leave the handle empty for a bounded share link.</p><form onSubmit={personal}><label>Recipient handle (optional)<input name="recipientHandle" placeholder="builder-handle" /></label><button>Create personal invite</button></form></section>
    <section className={styles.panel}><h2>Share what you are building now</h2><p>Create a bounded connection card around one active project. Anyone with the link can see the selected project’s title and summary, even when the rest of your profile is restricted.</p>{projects.length ? <form onSubmit={card}><label>Project<select name="project">{projects.map((project) => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select></label><label>Recipient handle (optional)<input name="recipientHandle" placeholder="builder-handle" /></label><button>Create connection card</button></form> : <p>Publish an active project before creating a connection card.</p>}</section>
    {url && <section className={styles.panel}><h2>New share link</h2><label>Share link<input readOnly value={url} onFocus={(event) => event.currentTarget.select()} /></label><button onClick={() => navigator.clipboard.writeText(url)}>Copy link</button></section>}
    <section className={styles.toggle}><h2>When the right person is not here yet</h2><p>Ask Buildmates to notify you when a newly joined builder passes your saved relevance preferences.</p><button aria-pressed={watching} onClick={toggle}>{watching ? "Notifications on" : "Notify me when someone relevant joins"}</button></section>
    {invites.length > 0 && <section className={styles.panel}><h2>Invitation history</h2><ul>{invites.map((invite) => <li key={invite.id}><span>{invite.kind.replaceAll("_", " ")} · {invite.useCount}/{invite.maximumUses} used · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>{invite.revokedAt ? <strong>Revoked</strong> : <button onClick={() => void revoke(invite.id)}>Revoke</button>}</li>)}</ul></section>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}
