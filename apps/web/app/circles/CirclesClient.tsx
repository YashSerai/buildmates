"use client";

import { FormEvent, useState } from "react";
import type { CircleListItem, CircleSuggestion } from "@/src/circles/service";
import styles from "./circles.module.css";

export function CirclesClient({ initialCircles, initialSuggestions }: { initialCircles: CircleListItem[]; initialSuggestions: CircleSuggestion[] }) {
  const [circles, setCircles] = useState(initialCircles);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

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
    const response = await fetch("/api/circles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      setMessage("Circle not created. Check the purpose and invited members, then try again.");
      return false;
    }
    await refresh();
    setOpen(false);
    setMessage("Circle created. You are its owner and the invited builders can decide for themselves.");
    return true;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await create({ name: String(form.get("name")), purpose: String(form.get("purpose")), governanceMode: form.get("governanceMode") === "vote" ? "vote" : "admin" })) event.currentTarget.reset();
  }

  return <section>
    {suggestions.length > 0 && <section className={styles.suggestions} aria-labelledby="circle-suggestions"><div className={styles.heading}><div><p>Natural groups</p><h2 id="circle-suggestions">A Circle may be useful now</h2></div></div><div className={styles.grid}>{suggestions.map((suggestion) => <article key={suggestion.id}><p>Connected triangle</p><h3>{suggestion.memberNames.join(" + ")}</h3><span>{suggestion.reason}</span><button onClick={() => void create({ name: `${suggestion.memberNames[0]}, ${suggestion.memberNames[1]} & you`, purpose: "A small Circle for the work and ideas already connecting this group.", governanceMode: "admin", inviteeUserIds: suggestion.memberUserIds })}>Start Circle and invite both</button></article>)}</div></section>}
    <div className={styles.heading}><div><p>Your groups</p><h2>Active and invited Circles</h2></div><button onClick={() => setOpen((value) => !value)}>{open ? "Cancel" : "Create a Circle"}</button></div>
    {open && <form className={styles.create} onSubmit={submit}><label>Name<input name="name" minLength={2} maxLength={80} required /></label><label>Purpose<textarea name="purpose" minLength={10} maxLength={600} rows={3} required /></label><fieldset><legend>How design and module changes publish</legend><label><input type="radio" name="governanceMode" value="admin" defaultChecked /> Admins publish member proposals</label><label><input type="radio" name="governanceMode" value="vote" /> Majority member vote</label></fieldset><button type="submit">Create Circle</button></form>}
    {circles.length ? <div className={styles.grid}>{circles.map((circle) => <article key={circle.id}><p>{circle.membershipStatus}{circle.role ? ` · ${circle.role}` : ""}</p><h3>{circle.name}</h3><span>{circle.purpose}</span><dl><dt>Members</dt><dd>{circle.memberCount}</dd><dt>Governance</dt><dd>{circle.governanceMode}</dd></dl><a href={`/circles/${circle.id}`}>{circle.membershipStatus === "invited" ? "Review invitation" : "Open Circle"}</a></article>)}</div> : <div className={styles.empty}><h3>No Circle yet</h3><p>Most relationships should stay simple Connections. Create a Circle when several builders share an ongoing purpose.</p></div>}
    <p className={styles.notice} role="status">{message}</p>
  </section>;
}
