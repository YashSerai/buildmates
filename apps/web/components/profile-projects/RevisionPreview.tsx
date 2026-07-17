"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./ProductForms.module.css";

type Revision = { id: string; revisionNumber: number; baseRevisionNumber: number | null; status: string; spec: unknown; createdAt: number };
type Data = {
  brief: { authorizedContent: SurfaceBindings } & Record<string, unknown>;
  surface: { id: string; publishedRevisionId: string | null; publishedRevisionNumber: number | null };
  history: Revision[];
};

export function RevisionPreview() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    setLoadError(false);
    try { const response = await fetch("/api/surfaces/profile", { cache: "no-store" });
      const value = await response.json() as Data & { error?: string };
      if (!response.ok) throw new Error(userFacingError(value.error, "Design workspace could not load."));
      setData(value);
    } catch(error) { setMessage(error instanceof Error?error.message:"Design workspace could not load.");setLoadError(true); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mutate(payload: object, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/surfaces/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const value = await response.json() as { error?: string };
      setMessage(response.ok ? success : userFacingError(value.error, "That design change could not be saved."));
      if (response.ok) await load();
      return response.ok;
    } finally { setBusy(false); }
  }
  const designPrompt = data ? `Redesign my Buildmates profile using the Buildmates profile-design workflow for design ${data.surface.id}. Create a private preview for me to review. Do not publish without my explicit approval.` : "";
  async function copyDesignPrompt() {
    try { await navigator.clipboard.writeText(designPrompt); setMessage("Codex design prompt copied."); }
    catch { setMessage("Copy was blocked. Use Design with Codex instead."); }
  }

  return <main className={styles.form}>
    <header><p className={styles.eyebrow}>Profile design</p><h1>Make this page feel like you.</h1><p>Codex designs with only the profile content you approved. It cannot expose private fields or replace Buildmates privacy, sharing, or navigation controls.</p></header>
    {message && !loadError && <p role="status">{message}</p>}
    {!data ? loadError?<div role="alert"><p>{message}</p><button type="button" onClick={()=>void load()}>Try again</button></div>:<p role="status">Loading design permissions…</p> : <>
      <div className={styles.actionRow}>
        <a className={styles.primaryAction} href={`codex://open?prompt=${encodeURIComponent(designPrompt)}`}>Design with Codex</a>
        <button type="button" onClick={copyDesignPrompt}>Copy Codex prompt</button>
      </div>
      <h2>Design history</h2>
      {data.history.length ? <ol>{data.history.map((revision) => {
        const published = data.surface.publishedRevisionId === revision.id;
        const currentBase = revision.baseRevisionNumber === data.surface.publishedRevisionNumber;
        return <li key={revision.id}>
          <p><strong>Design {revision.revisionNumber}</strong>{published ? " · published" : " · private preview"}</p>
          {!published && <SurfaceRenderer spec={revision.spec} bindings={data.brief.authorizedContent} />}
          {!published && currentBase && <button type="button" disabled={busy} onClick={() => mutate({ action: "publish", revisionId: revision.id, expectedPublishedRevisionNumber: data.surface.publishedRevisionNumber }, "Profile design published.")}>Publish this design</button>}
          {!published && !currentBase && <button type="button" disabled={busy} onClick={() => mutate({ action: "restore", revisionId: revision.id }, "A new private preview was created from that design.")}>Preview this design again</button>}
        </li>;
      })}</ol> : <p>No generated designs yet.</p>}
    </>}
  </main>;
}
