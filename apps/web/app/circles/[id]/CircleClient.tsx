"use client";

import { FormEvent, useState } from "react";
import type { CircleDetail, CircleMessage, CircleModuleEntry } from "@/src/circles/service";
import styles from "./circle.module.css";

export function CircleClient({ initialCircle, initialMessages, initialEntries }: { initialCircle: CircleDetail; initialMessages: CircleMessage[]; initialEntries: CircleModuleEntry[] }) {
  const [circle, setCircle] = useState(initialCircle);
  const [messages, setMessages] = useState(initialMessages);
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [entryDrafts, setEntryDrafts] = useState<Record<string, string>>({});

  async function command(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/circles/${encodeURIComponent(circle.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setMessage(data.error?.replaceAll("_", " ") ?? "Change not saved.");
      return false;
    }
    const refresh = await fetch(`/api/circles/${encodeURIComponent(circle.id)}`, { cache: "no-store" });
    if (refresh.ok) {
      const data = await refresh.json() as { circle: CircleDetail; messages: CircleMessage[]; entries: CircleModuleEntry[] };
      setCircle(data.circle);
      setMessages(data.messages);
      setEntries(data.entries);
    }
    return true;
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (await command({ action: "invite", handle: data.get("handle") })) event.currentTarget.reset();
  }
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind"));
    const payload = kind === "module" ? { kind: data.get("moduleKind"), config: { title: data.get("title") } } : { summary: data.get("title") };
    if (await command({ action: "propose", kind, payload })) event.currentTarget.reset();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const body = chatBody.trim();
    if (!body) return;
    if (await command({ action: "send_message", clientMessageId: crypto.randomUUID(), body })) setChatBody("");
  }

  if (circle.membershipStatus === "invited") return <section className={styles.invitation}>
    <h2>Join this Circle?</h2><p>You can see the purpose before deciding. Membership does not grant anyone access to your private Work Signals.</p>
    <div><button onClick={() => void command({ action: "respond_invite", accept: true })}>Join Circle</button><button onClick={() => void command({ action: "respond_invite", accept: false })}>Decline</button></div>
    <p role="status">{message}</p>
  </section>;

  if (circle.status !== "active") return <section className={styles.invitation}>
    <h2>{circle.status === "proposed" ? "Waiting for everyone to opt in" : "This Circle did not open"}</h2>
    <p>{circle.status === "proposed" ? "The shared Circle, member list, chat, and modules stay closed until every invited builder accepts." : "At least one invited builder declined or the Circle was archived. Your one-to-one Connections are unchanged."}</p>
    <a href="/circles">Return to Circles</a>
  </section>;

  const admin = circle.role === "owner" || circle.role === "admin";
  return <div className={styles.layout}>
    <section>
      <div className={styles.heading}><h2>Circle chat</h2><span>Visible only to active members</span></div>
      <div className={styles.chatLog} aria-live="polite">{messages.length ? messages.map((item) => <article key={item.id} className={item.mine ? styles.mine : undefined}><strong>{item.mine ? "You" : item.senderName}</strong><p>{item.body}</p><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString()}</time></article>) : <p className={styles.empty}>Start with the thread that brought this Circle together.</p>}</div>
      <form className={styles.chatComposer} onSubmit={send}><label>Message the Circle<textarea value={chatBody} onChange={(event) => setChatBody(event.target.value)} rows={3} maxLength={4000} /></label><button disabled={!chatBody.trim()}>Send</button></form>
    </section>
    <section>
      <div className={styles.heading}><h2>Members</h2><span>{circle.members.length} active or invited</span></div>
      <div className={styles.members}>{circle.members.map((member) => <article key={member.userId}>
        <span aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</span>
        <div><h3>{member.displayName}</h3><p>{member.role} · {member.status}</p>{member.userId !== circle.viewerUserId && admin && member.status === "active" && member.role !== "owner" ? <div className={styles.memberActions}>
          {circle.role === "owner" && (member.role === "member" ? <button onClick={() => void command({ action: "manage_member", targetUserId: member.userId, memberAction: "promote" })}>Make admin</button> : <button onClick={() => void command({ action: "manage_member", targetUserId: member.userId, memberAction: "demote" })}>Remove admin</button>)}
          {circle.role === "owner" && <button onClick={() => window.confirm(`Transfer Circle ownership to ${member.displayName}?`) && void command({ action: "manage_member", targetUserId: member.userId, memberAction: "transfer" })}>Transfer ownership</button>}
          <button onClick={() => window.confirm(`Remove ${member.displayName} from this Circle?`) && void command({ action: "manage_member", targetUserId: member.userId, memberAction: "remove" })}>Remove</button>
        </div> : null}</div>
      </article>)}</div>
      {admin && <form className={styles.inlineForm} onSubmit={invite}><label>Invite by Buildmates handle<input name="handle" placeholder="builder-handle" required /></label><button>Send invitation</button></form>}
      {circle.role !== "owner" && <button className={styles.leaveButton} onClick={() => window.confirm("Leave this Circle?") && void command({ action: "leave" })}>Leave Circle</button>}
    </section>
    <section>
      <div className={styles.heading}><h2>Proposed upgrades</h2><span>{circle.governanceMode === "vote" ? "Majority vote" : "Admins publish"}</span></div>
      <form className={styles.proposalForm} onSubmit={propose}>
        <label>Change type<select name="kind"><option value="module">Circle module</option><option value="design">Circle design</option><option value="rules">Tracker or leaderboard rules</option></select></label>
        <label>Module<select name="moduleKind"><option value="resource_shelf">Resource shelf</option><option value="experiment_tracker">Experiment tracker</option><option value="decision_log">Decision log</option><option value="feedback_queue">Feedback queue</option><option value="milestone_tracker">Milestone tracker</option><option value="scoreboard">Scoreboard</option></select></label>
        <label>Purpose or title<input name="title" maxLength={120} required /></label><button>Propose change</button>
      </form>
      {circle.proposals.length ? <div className={styles.proposals}>{circle.proposals.map((proposal) => <article key={proposal.id}><div><p>{proposal.kind}</p><h3>{String(proposal.payload.title ?? proposal.payload.summary ?? proposal.payload.kind ?? "Member proposal")}</h3><span>{proposal.status}</span></div><div>
        {circle.governanceMode === "vote" && proposal.status === "voting" && <><button onClick={() => void command({ action: "vote", proposalId: proposal.id, vote: "approve" })}>Approve</button><button onClick={() => void command({ action: "vote", proposalId: proposal.id, vote: "reject" })}>Reject</button></>}
        {((admin && circle.governanceMode === "admin") || proposal.status === "approved") && proposal.status !== "published" && <button onClick={() => void command({ action: "publish", proposalId: proposal.id })}>Publish</button>}
      </div></article>)}</div> : <p className={styles.empty}>No upgrades proposed. Keep the Circle lightweight until members need more structure.</p>}
    </section>
    <section>
      <div className={styles.heading}><h2>Active modules</h2><span>Approved group tools</span></div>
      {circle.modules.length ? <div className={styles.modules}>{circle.modules.filter((module) => module.active).map((module) => <article key={module.id}><p>{module.kind.replaceAll("_", " ")}</p><h3>{String(module.config.title ?? "Shared module")}</h3><div className={styles.moduleEntries}>{entries.filter((entry) => entry.moduleId === module.id).map((entry) => <div key={entry.id}><p>{String(entry.payload.body ?? "Entry")}</p><span>{entry.authorUserId === circle.viewerUserId ? "You" : entry.authorName} · {new Date(entry.createdAt).toLocaleDateString()}</span></div>)}</div><label>New entry<input value={entryDrafts[module.id] ?? ""} onChange={(event) => setEntryDrafts((current) => ({ ...current, [module.id]: event.target.value }))} maxLength={1000} /></label><button disabled={!entryDrafts[module.id]?.trim()} onClick={async () => { const body = entryDrafts[module.id]?.trim(); if (body && await command({ action: "add_entry", moduleId: module.id, payload: { body } })) setEntryDrafts((current) => ({ ...current, [module.id]: "" })); }}>Add entry</button></article>)}</div> : <p className={styles.empty}>No active modules.</p>}
    </section>
    <p className={styles.notice} role="status">{message}</p>
  </div>;
}
