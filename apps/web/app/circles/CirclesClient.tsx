"use client";

import { FormEvent, useState } from "react";
import type { CircleListItem, CircleSuggestion } from "@/src/circles/service";
import styles from "./circles.module.css";

export function CirclesClient({ initialCircles, initialSuggestions }: { initialCircles: CircleListItem[]; initialSuggestions: CircleSuggestion[] }) {
  const [circles, setCircles] = useState(initialCircles);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/circles", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as { circles: CircleListItem[]; suggestions: CircleSuggestion[] };
      setCircles(data.circles);
      setSuggestions(data.suggestions);
    }
  }
  async function create(payload: { name: string; purpose: string; governanceMode: "admin" | "vote"; inviteeUserIds?: string[] }) {
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/circles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        setMessage("Circle not created. Check its name, purpose, and invited builders, then try again.");
        return false;
      }
      await refresh();
      setOpen(false);
      setMessage(payload.inviteeUserIds?.length ? "Invitations sent. The Circle opens after every invited builder joins." : "Circle created. You are its owner.");
      return true;
    } catch {
      setMessage("Buildmates could not reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await create({ name: String(form.get("name")), purpose: String(form.get("purpose")), governanceMode: form.get("governanceMode") === "vote" ? "vote" : "admin" })) event.currentTarget.reset();
  }

  return <section>
    {suggestions.length > 0 && <section className={styles.suggestions} aria-labelledby="circle-suggestions"><div className={styles.heading}><div><p>Related Connections</p><h2 id="circle-suggestions">This conversation may work better as a group</h2></div></div><div className={styles.grid}>{suggestions.map((suggestion) => <article key={suggestion.id}><p>Three connected builders</p><h3>{suggestion.memberNames.join(" + ")}</h3><span>{suggestion.reason}</span><button disabled={busy} onClick={() => void create({ name: `${suggestion.memberNames[0]}, ${suggestion.memberNames[1]} & you`, purpose: suggestion.reason, governanceMode: "admin", inviteeUserIds: suggestion.memberUserIds })}>{busy?"Sending invitations…":"Invite both to a Circle"}</button></article>)}</div></section>}
    <div className={styles.heading}><div><p>Your groups</p><h2>Active and invited Circles</h2></div><button onClick={() => setOpen((value) => !value)}>{open ? "Cancel" : "Create a Circle"}</button></div>
    {open && <form className={styles.create} onSubmit={submit}><label>Name<input name="name" minLength={2} maxLength={80} required /></label><label>Purpose<textarea name="purpose" minLength={10} maxLength={600} rows={3} required /></label><fieldset><legend>Who approves design and shared-tool changes?</legend><label><input type="radio" name="governanceMode" value="admin" defaultChecked /> Admins publish member proposals</label><label><input type="radio" name="governanceMode" value="vote" /> Members decide by majority vote</label></fieldset><button type="submit" disabled={busy}>{busy?"Creating Circle…":"Create Circle"}</button></form>}
    {circles.length ? <div className={styles.grid}>{circles.map((circle) => <article key={circle.id}><p>{membershipLabel(circle.membershipStatus)}{circle.role ? ` · ${roleLabel(circle.role)}` : ""}</p><h3>{circle.name}</h3><span>{circle.purpose}</span><dl><dt>Members</dt><dd>{circle.memberCount}</dd><dt>Changes approved by</dt><dd>{circle.governanceMode === "vote" ? "Member vote" : "Admins"}</dd></dl><a href={`/circles/${circle.id}`}>{circle.membershipStatus === "invited" ? "Review invitation" : "Open Circle"}</a></article>)}</div> : <div className={styles.empty}><h3>No Circles yet</h3><p>Most relationships can stay as one-to-one Connections. Create a Circle when several builders want an ongoing shared space.</p></div>}
    <p className={styles.notice} role="status">{message}</p>
  </section>;
}

function membershipLabel(value: string) { return ({active:"Joined",invited:"Invitation waiting",left:"Left",declined:"Declined",removed:"Removed"} as Record<string,string>)[value] ?? "Unavailable"; }
function roleLabel(value: string) { return ({owner:"Owner",admin:"Admin",member:"Member"} as Record<string,string>)[value] ?? "Member"; }
