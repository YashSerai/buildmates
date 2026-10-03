"use client";

import { FormEvent, useState } from "react";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./recovery.module.css";

type RecoveryDisposition = "no_effect" | "completed_effect";
type Inspection = {
  id: string;
  actorUserId: string;
  operation: string;
  requestHash: string;
  status: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  ageMs: number;
  hasResponse: boolean;
  recovery: { mode: "supported" | "manual_only"; allowedDispositions: RecoveryDisposition[]; message: string | null };
};

export default function RecoveryConsole() {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [message, setMessage] = useState("");
  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const id = String(new FormData(event.currentTarget).get("id") ?? "");
    const response = await fetch(`/api/operator/idempotency-recovery?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const body = await response.json() as { inspection?: Inspection; error?: string; message?: string };
    setInspection(body.inspection ?? null); setMessage(response.ok ? "" : body.message ?? userFacingError(body.error, "The row could not be inspected."));
  }
  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!inspection) return;
    const data = new FormData(event.currentTarget); const disposition = String(data.get("disposition"));
    const effectKind = String(data.get("effectKind") ?? "").trim(); const effectId = String(data.get("effectId") ?? "").trim();
    const response = await fetch("/api/operator/idempotency-recovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: inspection.id, requestHash: inspection.requestHash, reason: data.get("reason"), disposition, effectLocator: disposition === "completed_effect" ? { kind: effectKind, id: effectId } : undefined }) });
    const body = await response.json() as { recovered?: boolean; error?: string; message?: string };
    setMessage(body.recovered ? "Recovery recorded. Inspect the row again before any further action." : body.message ?? userFacingError(body.error, "Recovery failed."));
    if (body.recovered) setInspection(null);
  }
  const allowedDispositions = inspection?.recovery.allowedDispositions ?? [];
  return <main className={styles.main}>
    <header><p className={styles.eyebrow}>Buildmates operations</p><h1>Idempotency recovery</h1><p>Use only after proving the original runner stopped. Expiry alone is not proof.</p></header>
    <form className={styles.panel} onSubmit={inspect}><label htmlFor="recovery-id">Exact idempotency row ID</label><div className={styles.row}><input id="recovery-id" name="id" required /><button type="submit">Inspect</button></div></form>
    {inspection && <section className={styles.panel}>
      <dl><div><dt>Actor</dt><dd>{inspection.actorUserId}</dd></div><div><dt>Operation</dt><dd>{inspection.operation}</dd></div><div><dt>Status</dt><dd>{inspection.status}</dd></div><div><dt>Request hash</dt><dd className={styles.hash}>{inspection.requestHash}</dd></div></dl>
      {inspection.recovery.mode === "manual_only" ? <p role="alert" className={styles.status}>{inspection.recovery.message}</p> : <form onSubmit={recover}>
        {inspection.recovery.message && <p className={styles.status}>{inspection.recovery.message}</p>}
        <label htmlFor="reason">Verified recovery reason</label><textarea id="reason" name="reason" minLength={12} required />
        <label htmlFor="disposition">Disposition</label><select id="disposition" name="disposition" defaultValue={allowedDispositions[0]}>
          {allowedDispositions.includes("no_effect") && <option value="no_effect">No canonical effect occurred</option>}
          {allowedDispositions.includes("completed_effect") && <option value="completed_effect">Canonical effect is complete</option>}
        </select>
        {allowedDispositions.includes("completed_effect") && <div className={styles.grid}><label>Effect kind<input name="effectKind" /></label><label>Canonical effect ID<input name="effectId" /></label></div>}
        <button type="submit">Apply audited recovery</button>
      </form>}
    </section>}
    {message && <p role="status" className={styles.status}>{message}</p>}
  </main>;
}
