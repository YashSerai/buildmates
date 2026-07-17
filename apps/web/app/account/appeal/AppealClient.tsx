"use client";

import { useState } from "react";
import type { AppealableOutcome } from "@/src/moderation/service";
import { userFacingError } from "@/src/client/user-facing-error";

export function AppealClient({ initialOutcomes }: { initialOutcomes: AppealableOutcome[] }) {
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [statement, setStatement] = useState("");
  const [selected, setSelected] = useState(initialOutcomes.find((item) => item.caseStatus === "actioned")?.caseId ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const response = await fetch("/api/moderation-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: selected, statement }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) {
      setOutcomes((items) => items.map((item) => item.caseId === selected ? { ...item, caseStatus: "appealed", appealStatus: "received" } : item));
      setStatement(""); setNotice("Appeal received. You can return here to check its status.");
    } else setNotice(userFacingError(payload.error, "The appeal could not be submitted."));
    setBusy(false);
  }

  if (!outcomes.length) return <p>No appealable safety outcomes were found for this account.</p>;
  return <>
    <ul>{outcomes.map((item) => <li key={item.caseId}><strong>{item.action.replaceAll("_", " ")}</strong> · {item.reasonCode.replaceAll("_", " ")} · {item.appealStatus ? `appeal ${item.appealStatus}` : item.caseStatus}</li>)}</ul>
    {outcomes.some((item) => item.caseStatus === "actioned") ? <form onSubmit={submit}>
      <label>Outcome<select value={selected} onChange={(event) => setSelected(event.target.value)}>{outcomes.filter((item) => item.caseStatus === "actioned").map((item) => <option key={item.caseId} value={item.caseId}>{item.action.replaceAll("_", " ")} · {new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(item.createdAt)}</option>)}</select></label>
      <label>Why should this outcome be reviewed again?<textarea required minLength={20} maxLength={3000} rows={7} value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
      <button disabled={busy || !selected || statement.trim().length < 20}>{busy ? "Submitting…" : "Submit appeal"}</button>
    </form> : null}
    <p role="status" aria-live="polite">{notice}</p>
  </>;
}
