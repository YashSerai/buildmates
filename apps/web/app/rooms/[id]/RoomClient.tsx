"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { RoomMessage, RoomSummary } from "@/src/rooms/service";
import styles from "./room.module.css";

type Upgrade = { id: string; modules: string[]; explanation: string; status: string; acceptCount: number; mine: boolean };
type Module = { id: string; kind: string; active: boolean };
type Meeting = { id: string; startsAt: number; endsAt: number; timezone: string; note: string | null; status: string; mine: boolean; parentProposalId: string | null };
type Receipt = { id: string; provider: string; providerEventId: string; startsAt: number; endsAt: number; status: string };
type Availability = { id: string; startsAt: number; endsAt: number; timezone: string; status: string };
type AvailabilityIntersection = { startsAt: number; endsAt: number; myTimezone: string; theirTimezone: string };

export type RoomEnhancements = {
  upgrades: Upgrade[];
  modules: Module[];
  meetings: Meeting[];
  receipts: Receipt[];
  myAvailability: Availability[];
  availabilityIntersections: AvailabilityIntersection[];
};

export function RoomClient({ room, initialMessages, initialEnhancements }: { room: RoomSummary; initialMessages: RoomMessage[]; initialEnhancements: RoomEnhancements }) {
  const [messages, setMessages] = useState(initialMessages);
  const [enhancements, setEnhancements] = useState(initialEnhancements);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [sending, setSending] = useState(false);
  const [module, setModule] = useState("resource_shelf");
  const [upgradeWhy, setUpgradeWhy] = useState("");
  const cursor = useRef<string | null>(initialMessages.length ? cursorFor(initialMessages[initialMessages.length - 1]!) : null);
  const end = useRef<HTMLDivElement>(null);
  const accepted = enhancements.meetings.find((meeting) => meeting.status === "accepted");
  const schedulePrompt = accepted
    ? `Open my Buildmates room ${room.id}. Schedule its accepted meeting proposal ${accepted.id} from ${new Date(accepted.startsAt).toISOString()} to ${new Date(accepted.endsAt).toISOString()} (${accepted.timezone}) using my connected Calendar under its existing permissions. Then attach the provider-confirmed event receipt to this same room and proposal.`
    : `Open my Buildmates room ${room.id} and help us agree on a meeting time. Do not create a Calendar event until a proposal has been accepted in the room.`;

  const refreshEnhancements = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/lifecycle`, { cache: "no-store" });
    if (response.ok) setEnhancements(await response.json() as RoomEnhancements);
  }, [room.id]);

  async function lifecycle(payload: object) {
    setNotice("");
    const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/lifecycle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setNotice(data.error === "positive_feedback_required" ? "Share positive introduction feedback from Connections before upgrading this room." : "That room change could not be saved.");
      return false;
    }
    await refreshEnhancements();
    setNotice("Saved.");
    return true;
  }

  const poll = useCallback(async () => {
    const query = cursor.current ? `?after=${encodeURIComponent(cursor.current)}` : "";
    const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/messages${query}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { messages: RoomMessage[]; cursor: string | null };
    if (data.messages.length) {
      setMessages((current) => [...current, ...data.messages.filter((next) => !current.some((item) => item.id === next.id))]);
      void lifecycleRequest(room.id, { action: "read", messageId: data.messages[data.messages.length - 1]!.id });
    }
    cursor.current = data.cursor;
  }, [room.id]);

  useEffect(() => { const timer = window.setInterval(() => void poll(), 5000); return () => window.clearInterval(timer); }, [poll]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);
  useEffect(() => { const last = initialMessages[initialMessages.length - 1]; if (last) void lifecycleRequest(room.id, { action: "read", messageId: last.id }); }, [initialMessages, room.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true); setNotice("");
    const optimisticId = `local-${crypto.randomUUID()}`;
    const optimistic: RoomMessage = { id: optimisticId, senderUserId: "me", body: text, createdAt: Date.now(), editedAt: null, mine: true };
    setMessages((current) => [...current, optimistic]); setBody("");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientMessageId: optimisticId, body: text }) });
      if (!response.ok) throw new Error();
      const stored = await response.json() as { id: string; createdAt: number };
      setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, ...stored } : message));
      // Only server polling advances the cursor. Moving it from an optimistic send
      // can skip a concurrent message that committed just before this one.
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimisticId)); setBody(text); setNotice("Message not sent. Your draft is still here.");
    } finally { setSending(false); }
  }

  async function proposeTime(event: FormEvent, parentProposalId?: string) {
    event.preventDefault(); if (!scheduleStart) return;
    const startsAt = new Date(scheduleStart).getTime();
    if (await lifecycle({ action: "propose_meeting", clientRequestId: crypto.randomUUID(), startsAt, endsAt: startsAt + 30 * 60_000, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, note: null, parentProposalId: parentProposalId ?? null })) setScheduleStart("");
  }

  async function saveAvailability(event: FormEvent) {
    event.preventDefault();
    const startsAt = new Date(availabilityStart).getTime(), endsAt = new Date(availabilityEnd).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return;
    if (await lifecycle({ action: "save_availability", clientWindowId: crypto.randomUUID(), startsAt, endsAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })) { setAvailabilityStart(""); setAvailabilityEnd(""); }
  }

  async function copySchedulePrompt() { try { await navigator.clipboard.writeText(schedulePrompt); setNotice("Scheduling prompt copied."); } catch { setNotice("Copy was blocked. Select the prompt and copy it manually."); } }
  async function safety(action: "block" | "report") {
    if (action === "block" && !window.confirm(`Block ${room.otherName}? This room will close.`)) return;
    const request = action === "block" ? { action, targetUserId: room.otherUserId } : { action, targetKind: "room", targetId: room.id, reasonCode: "other", details: "Reported from room controls" };
    const response = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
    if (response.ok && action === "block") window.location.assign("/connections"); else setNotice(response.ok ? "Report received." : "That safety action could not be completed.");
  }

  const icsHref = accepted ? `/api/rooms/${encodeURIComponent(room.id)}/calendar.ics?start=${encodeURIComponent(new Date(accepted.startsAt).toISOString())}` : scheduleStart ? `/api/rooms/${encodeURIComponent(room.id)}/calendar.ics?start=${encodeURIComponent(new Date(scheduleStart).toISOString())}` : null;
  return <section className={styles.chat} aria-label={`Conversation with ${room.otherName}`}>
    <div className={styles.messages} aria-live="polite">{messages.length ? messages.map((message) => <article key={message.id} className={message.mine ? styles.mine : styles.theirs}><span>{message.mine ? "You" : room.otherName}</span><p>{message.body}</p><time dateTime={new Date(message.createdAt).toISOString()}>{new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(message.createdAt)}{message.editedAt ? " · edited" : ""}</time></article>) : <div className={styles.first}><p>Start with what connected you.</p><h2>What are you testing, changing, or trying to understand right now?</h2><span>This room begins as a simple conversation. Buildmates may suggest an upgrade after useful feedback.</span></div>}<div ref={end} /></div>
    <form className={styles.composer} onSubmit={submit}><label htmlFor="message">Message {room.otherName}</label><textarea id="message" value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder="Share the current edge of your work…" /><div><span>{body.length}/4000</span><button type="submit" disabled={sending || !body.trim()}>{sending ? "Sending…" : "Send message"}</button></div><p role="status" aria-live="polite">{notice}</p></form>
    {enhancements.modules.length > 0 && <section className={styles.modules}><p>Room tools</p>{enhancements.modules.map((item) => <span key={item.id}>{label(item.kind)}</span>)}</section>}
    <section className={styles.upgrade}><div><p>Grow the room when it is useful</p><h2>Propose one shared tool</h2><span>Both people approve before anything changes.</span></div><form onSubmit={async (event) => { event.preventDefault(); if (await lifecycle({ action: "propose_upgrade", modules: [module], explanation: upgradeWhy })) setUpgradeWhy(""); }}><select value={module} onChange={(event) => setModule(event.target.value)} aria-label="Room tool"><option value="resource_shelf">Resource shelf</option><option value="experiment_tracker">Experiment tracker</option><option value="decision_log">Decision log</option><option value="feedback_queue">Feedback queue</option><option value="milestone_tracker">Milestone tracker</option></select><input value={upgradeWhy} onChange={(event) => setUpgradeWhy(event.target.value)} maxLength={1000} placeholder="Why this would help now" /><button disabled={!upgradeWhy.trim()}>Propose</button></form>{enhancements.upgrades.filter((item) => item.status === "proposed" && !item.mine).map((item) => <div className={styles.proposal} key={item.id}><span>{item.explanation}</span><button onClick={() => void lifecycle({ action: "respond_upgrade", proposalId: item.id, response: "accepted" })}>Approve tool</button><button onClick={() => void lifecycle({ action: "respond_upgrade", proposalId: item.id, response: "declined" })}>Decline</button></div>)}</section>
    <aside className={styles.schedule}><div><p>Continue live</p><h2>Find a time to talk</h2><span>Share private availability, use an overlap to propose a time, then continue in Codex with Calendar or download an ICS file.</span><form className={styles.availability} onSubmit={saveAvailability}><label>Available from<input type="datetime-local" value={availabilityStart} onChange={(event) => setAvailabilityStart(event.target.value)} /></label><label>Until<input type="datetime-local" value={availabilityEnd} onChange={(event) => setAvailabilityEnd(event.target.value)} /></label><button disabled={!availabilityStart || !availabilityEnd}>Add availability</button></form>{enhancements.myAvailability.map((window) => <div className={styles.window} key={window.id}><span>{new Date(window.startsAt).toLocaleString()} – {new Date(window.endsAt).toLocaleTimeString()}</span><button type="button" onClick={() => void lifecycle({ action: "withdraw_availability", windowId: window.id })}>Remove</button></div>)}</div><div>{enhancements.availabilityIntersections.length > 0 && <div className={styles.overlaps}><strong>Times that work for both</strong>{enhancements.availabilityIntersections.map((window) => <button type="button" key={`${window.startsAt}:${window.endsAt}`} onClick={() => setScheduleStart(toLocalDateTime(window.startsAt))}>{new Date(window.startsAt).toLocaleString()}</button>)}</div>}<form onSubmit={proposeTime}><label>Suggested start<input type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} /></label><button disabled={!scheduleStart}>Propose 30 minutes</button></form>{enhancements.meetings.filter((meeting) => meeting.status === "proposed" && !meeting.mine).map((meeting) => <div className={styles.meeting} key={meeting.id}><time>{new Date(meeting.startsAt).toLocaleString()}</time><button onClick={() => void lifecycle({ action: "respond_meeting", proposalId: meeting.id, response: "accepted" })}>Accept</button><button onClick={() => void lifecycle({ action: "respond_meeting", proposalId: meeting.id, response: "declined" })}>Decline</button><button onClick={(event) => void proposeTime(event, meeting.id)} disabled={!scheduleStart}>Counter with chosen time</button></div>)}<a href={`codex://open?prompt=${encodeURIComponent(schedulePrompt)}`}>Continue in Codex</a><button type="button" onClick={() => void copySchedulePrompt()}>Copy prompt</button>{icsHref ? <a href={icsHref}>Download ICS</a> : <span className={styles.disabled}>Agree on a time for ICS</span>}</div></aside>
    <footer className={styles.safety}><button onClick={() => void safety("report")}>Report room</button><button onClick={() => void safety("block")}>Block {room.otherName}</button></footer>
  </section>;
}

function cursorFor(message: { createdAt: number; id: string }) { return `${message.createdAt}:${encodeURIComponent(message.id)}`; }
function label(value: string) { return value.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" "); }
function toLocalDateTime(value: number) { const date = new Date(value - new Date(value).getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }
async function lifecycleRequest(roomId: string, body: object) { await fetch(`/api/rooms/${encodeURIComponent(roomId)}/lifecycle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null); }
