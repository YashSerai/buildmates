"use client";

import { useState } from "react";
import styles from "./cohorts.module.css";

export function JoinCohort({ id, currentStatus }: { id: string; currentStatus: string | null }) {
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function updateMembership(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/cohorts/${encodeURIComponent(id)}/membership`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      });
      const body = await response.json() as { status?: string; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update your membership");
        return;
      }
      setStatus(method === "DELETE" ? null : (body.status ?? "requested"));
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.actions}>
    {status === "active" ? <>
      <span>You are a member.</span>
      <button disabled={busy} onClick={() => updateMembership("DELETE")}>Leave cohort</button>
    </> : status === "requested" ? <>
      <span>Your request is waiting for an admin.</span>
      <button disabled={busy} onClick={() => updateMembership("DELETE")}>Cancel request</button>
    </> : <button disabled={busy} onClick={() => updateMembership("POST")}>Join this cohort</button>}
    {error && <span role="alert">{error}</span>}
  </div>;
}

export function CohortInvite({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setError("");
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "cohort_admin", targetId: id, maximumUses: 50 }),
    });
    const body = await response.json() as { token?: string; error?: string };
    if (!response.ok || !body.token) {
      setError(body.error ?? "Could not create invite");
      return;
    }
    setUrl(`${location.origin}/i/${body.token}`);
  }

  return <div className={styles.actions}>
    <button onClick={create}>Create cohort invite</button>
    {url && <div className={styles.share}>
      <label>Share this link<input readOnly value={url} /></label>
      <button onClick={() => navigator.clipboard.writeText(url)}>Copy link</button>
    </div>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
