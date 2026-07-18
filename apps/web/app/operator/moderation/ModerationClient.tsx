"use client";

import { useState } from "react";
import { useTextPromptDialog } from "@/components/discovery/ConfirmDialog";
import type { ModerationCaseView } from "@/src/moderation/service";
import styles from "./moderation.module.css";

type QueueStatus = "open" | "reviewing" | "appealed";
type Action = "review" | "dismiss" | "warn" | "restrict_matching" | "suspend_account";

export function ModerationClient({ initialCases }: { initialCases: ModerationCaseView[] }) {
  const [cases, setCases] = useState(initialCases);
  const [status, setStatus] = useState<QueueStatus>("open");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { prompt, promptDialog } = useTextPromptDialog();

  async function load(nextStatus: QueueStatus) {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/operator/moderation?status=${nextStatus}`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json() as { cases: ModerationCaseView[] };
      setCases(payload.cases);
      setStatus(nextStatus);
    } else {
      setNotice("The moderation queue could not be loaded.");
    }
    setBusy(false);
  }

  async function act(caseId: string, action: Action) {
    const reasonCode = await prompt({
      title: "Record a policy reason",
      description: "This note becomes part of the moderation record and should explain the policy basis for the action.",
      confirmLabel: "Record action",
    });
    if (!reasonCode) return;
    setBusy(true);
    const response = await fetch("/api/operator/moderation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, action, reasonCode }) });
    if (response.ok) {
      setNotice(action === "review" ? "Case moved to review." : "Moderation outcome recorded.");
      setCases((items) => items.filter((item) => item.caseId !== caseId));
    } else {
      setNotice("The outcome was not recorded. The case may have changed in another session; reload this queue.");
    }
    setBusy(false);
  }

  return <section className={styles.queue} aria-busy={busy}>{promptDialog}
    <nav aria-label="Moderation queue">
      {(["open", "reviewing", "appealed"] as const).map((value) => <button key={value} type="button" aria-current={status === value ? "page" : undefined} disabled={busy || status === value} onClick={() => void load(value)}>{value === "open" ? "New reports" : value === "reviewing" ? "In review" : "Appeals"}</button>)}
    </nav>
    {cases.length ? cases.map((item) => <article key={item.caseId}>
      <div><span>{item.reasonCode.replaceAll("_", " ")}</span><h2>{item.targetKind} · {item.targetId}</h2><p>{item.details || "No additional details supplied."}</p><small>Report {item.reportId} · case {item.caseStatus} · target user {item.targetUserId ?? "not resolved"}</small></div>
      <div>
        {item.caseStatus !== "reviewing" && <button disabled={busy} onClick={() => void act(item.caseId, "review")}>{item.caseStatus === "appealed" ? "Review appeal" : "Take review"}</button>}
        <button disabled={busy} onClick={() => void act(item.caseId, "dismiss")}>Close with no action</button>
        {item.targetUserId && <><button disabled={busy} onClick={() => void act(item.caseId, "warn")}>Warn</button><button disabled={busy} onClick={() => void act(item.caseId, "restrict_matching")}>Restrict matching</button><button disabled={busy} className={styles.danger} onClick={() => void act(item.caseId, "suspend_account")}>Suspend account</button></>}
      </div>
    </article>) : <div className={styles.empty}><h2>No {status === "open" ? "new reports" : status === "reviewing" ? "cases in review" : "appeals waiting"}.</h2><p>{status === "open" ? "New reports appear here in received order." : status === "reviewing" ? "Cases move here when an operator takes review." : "Appealed outcomes appear here for another review."}</p></div>}
    <p role="status" aria-live="polite">{notice}</p>
  </section>;
}
