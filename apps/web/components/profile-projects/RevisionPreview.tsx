"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import styles from "./ProductForms.module.css";

type Revision = { id: string; revisionNumber: number; baseRevisionNumber: number | null; status: string; spec: unknown; createdAt: number };
type Data = {
  brief: { authorizedContent: SurfaceBindings } & Record<string, unknown>;
  surface: { publishedRevisionId: string | null; publishedRevisionNumber: number | null };
  history: Revision[];
};

export function RevisionPreview() {
  const [data, setData] = useState<Data | null>(null);
  const [spec, setSpec] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/surfaces/profile", { cache: "no-store" });
    const value = await response.json() as Data & { error?: string };
    if (response.ok) setData(value);
    else setMessage(value.error ?? "Design workspace could not load.");
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mutate(payload: object, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/surfaces/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const value = await response.json() as { error?: string };
      setMessage(response.ok ? success : (value.error === "surface_conflict" ? "Your published profile changed. Refresh before publishing this revision." : (value.error ?? "Revision could not be saved.")));
      if (response.ok) await load();
      return response.ok;
    } finally { setBusy(false); }
  }
  async function create() {
    try {
      if (await mutate({ action: "draft", spec: JSON.parse(spec) }, "Private profile preview created.")) setSpec("");
    } catch { setMessage("Paste a complete JSON SurfaceSpec."); }
  }

  return <main className={styles.form}>
    <header><p className={styles.eyebrow}>Profile design</p><h1>Make this page feel like you.</h1><p>Ask Codex to use the authorized brief. Generated pages are data-driven, so a new design never needs a deployment and cannot change privacy or product controls.</p></header>
    {message && <p role="status">{message}</p>}
    {!data ? <p>Loading design permissions…</p> : <>
      <details><summary>Authorized Codex generation brief</summary><pre>{JSON.stringify(data.brief, null, 2)}</pre></details>
      <label>SurfaceSpec JSON<textarea rows={16} value={spec} onChange={(event) => setSpec(event.target.value)} /></label>
      <button type="button" disabled={busy || !spec.trim()} onClick={create}>Validate private preview</button>
      <h2>Revision history</h2>
      {data.history.length ? <ol>{data.history.map((revision) => {
        const published = data.surface.publishedRevisionId === revision.id;
        const currentBase = revision.baseRevisionNumber === data.surface.publishedRevisionNumber;
        return <li key={revision.id}>
          <p><strong>Revision {revision.revisionNumber}</strong>{published ? " · published" : " · private preview"}</p>
          {!published && <SurfaceRenderer spec={revision.spec} bindings={data.brief.authorizedContent} />}
          {!published && currentBase && <button type="button" disabled={busy} onClick={() => mutate({ action: "publish", revisionId: revision.id, expectedPublishedRevisionNumber: data.surface.publishedRevisionNumber }, "Profile design published.")}>Publish this revision</button>}
          {!published && !currentBase && <button type="button" disabled={busy} onClick={() => mutate({ action: "restore", revisionId: revision.id }, "A new rollback preview was created.")}>Use as rollback preview</button>}
        </li>;
      })}</ol> : <p>No generated revisions yet.</p>}
    </>}
  </main>;
}
