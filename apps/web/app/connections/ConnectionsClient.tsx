"use client";

import { FormEvent, useState } from "react";
import type { ConnectionListItem } from "@/src/rooms/service";
import styles from "./connections.module.css";

type Detail = {
  state: "active" | "ended";
  muted: boolean;
  renewedRelevanceEnabled: boolean;
  updatesEnabled: boolean;
  privateNote: string | null;
  otherUserId: string;
  reminders: { id: string; remindAt: number }[];
  reconnect: { id: string; requesterUserId: string } | null;
};

export function ConnectionsClient({ initialConnections }: { initialConnections: ConnectionListItem[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(id: string) {
    const response = await fetch(`/api/connections/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (response.ok) {
      const detail = await response.json() as Detail;
      setDetails((current) => ({ ...current, [id]: detail }));
    }
  }
  async function toggle(id: string) {
    setOpen((current) => current === id ? null : id);
    if (!details[id]) await refresh(id);
  }
  async function command(id: string, body: object) {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setNotice("That change could not be saved.");
      setBusy(false);
      return false;
    }
    await refresh(id);
    setNotice("Saved.");
    setBusy(false);
    return true;
  }
  async function safety(connection: ConnectionListItem, action: "block" | "report") {
    if (action === "block" && !window.confirm(`Block ${connection.otherName}? They will no longer be able to contact you.`)) return;
    const body = action === "block"
      ? { action, targetUserId: connection.otherUserId }
      : { action, targetKind: "room", targetId: connection.roomId, reasonCode: "other", details: "Reported from connection controls" };
    const response = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok && action === "block") setConnections((current) => current.filter((item) => item.id !== connection.id));
    setNotice(response.ok ? (action === "block" ? "Builder blocked." : "Report received.") : "That safety action could not be completed.");
  }

  return <section className={styles.list} aria-label="Connections">
    {connections.map((connection) => {
      const detail = details[connection.id];
      const state = detail?.state ?? connection.state;
      return <article key={connection.id} className={styles.connection}>
        <div className={styles.summary}>
          <div className={styles.avatar} aria-hidden="true">{connection.otherName.slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>{connection.otherName}</h2>
            <p>{connection.otherSummary}</p>
            <p><strong>Why you met:</strong> {connection.connectionReason}</p>
            {connection.sharedContext.length > 0 && <ul>{connection.sharedContext.map((item) => <li key={item}>{item}</li>)}</ul>}
            <span>Connected {new Date(connection.createdAt).toLocaleDateString()} · {state}{(detail?.muted ?? connection.muted) ? " · muted" : ""}</span>
          </div>
          <div className={styles.actions}>
            {state === "active" && <a href={`/rooms/${connection.roomId}`}>Open room</a>}
            <button type="button" onClick={() => void toggle(connection.id)} aria-expanded={open === connection.id}>Manage</button>
          </div>
        </div>
        {open === connection.id && <div className={styles.manage}>{detail ? <>
          <div className={styles.toggles}>
            <label><input type="checkbox" checked={detail.muted} onChange={(event) => void command(connection.id, { action: "preference", kind: "muted", enabled: event.target.checked })} />Mute notifications</label>
            <label><input type="checkbox" checked={detail.updatesEnabled} onChange={(event) => void command(connection.id, { action: "preference", kind: "updates", enabled: event.target.checked })} />Show public project updates</label>
            <label><input type="checkbox" checked={detail.renewedRelevanceEnabled} onChange={(event) => void command(connection.id, { action: "preference", kind: "renewed_relevance", enabled: event.target.checked })} />Tell me when our work overlaps again</label>
          </div>
          <NoteForm initial={detail.privateNote ?? ""} disabled={busy} onSave={(body) => command(connection.id, { action: "private_note", body })} />
          <ReminderForm disabled={busy} onSave={(remindAt) => command(connection.id, { action: "reminder", remindAt })} />
          <FeedbackForm disabled={busy} onSave={(value) => command(connection.id, { action: "feedback", ...value })} />
          <div className={styles.lifecycle}>
            {detail.state === "active"
              ? <button type="button" disabled={busy} onClick={() => window.confirm("End this connection? You can request to reconnect later.") && void command(connection.id, { action: "end" })}>End connection</button>
              : detail.reconnect && detail.reconnect.requesterUserId === detail.otherUserId
                ? <button type="button" disabled={busy} onClick={() => void command(connection.id, { action: "respond_reconnect", requestId: detail.reconnect!.id, response: "accepted" })}>Accept reconnect</button>
                : <button type="button" disabled={busy} onClick={() => void command(connection.id, { action: "reconnect" })}>Request to reconnect</button>}
            <button type="button" onClick={() => void safety(connection, "report")}>Report</button>
            <button type="button" className={styles.danger} onClick={() => void safety(connection, "block")}>Block</button>
          </div>
        </> : <p>Loading controls…</p>}</div>}
      </article>;
    })}
    <p className={styles.notice} role="status">{notice}</p>
  </section>;
}

function NoteForm({ initial, disabled, onSave }: { initial: string; disabled: boolean; onSave: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState(initial);
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(body); }}><label>Private note<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={3} placeholder="Only you can see this." /></label><button disabled={disabled}>Save note</button></form>;
}
function ReminderForm({ disabled, onSave }: { disabled: boolean; onSave: (at: number) => Promise<boolean> }) {
  const [at, setAt] = useState("");
  return <form onSubmit={(event) => { event.preventDefault(); if (at) void onSave(new Date(at).getTime()); }}><label>Reconnect reminder<input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} /></label><button disabled={disabled || !at}>Set reminder</button></form>;
}
function FeedbackForm({ disabled, onSave }: { disabled: boolean; onSave: (value: object) => Promise<boolean> }) {
  const [useful, setUseful] = useState(true);
  const [reason, setReason] = useState("good_conversation");
  return <form onSubmit={(event: FormEvent) => { event.preventDefault(); void onSave({ useful, reasons: [reason], similarMatchPreference: "same", followUpIntent: useful ? "keep_connected" : "not_now", privateNote: null }); }}>
    <fieldset><legend>How was the introduction?</legend><label><input type="radio" name="feedback" checked={useful} onChange={() => setUseful(true)} />Useful</label><label><input type="radio" name="feedback" checked={!useful} onChange={() => setUseful(false)} />Not for me</label></fieldset>
    <label>What stood out?<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="good_conversation">Good conversation</option><option value="shared_context">Shared context</option><option value="future_relevance">Future relevance</option><option value="collaboration_started">We started collaborating</option><option value="timing_off">Timing was off</option><option value="not_relevant">Not relevant</option></select></label>
    <button disabled={disabled}>Save feedback</button>
  </form>;
}
