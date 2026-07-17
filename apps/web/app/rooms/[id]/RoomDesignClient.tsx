"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./room.module.css";

type Revision = {
  id: string;
  revisionNumber: number;
  baseRevisionNumber: number | null;
  authorUserId: string;
  authorName: string;
  status: string;
  spec: unknown;
  createdAt: number;
  myDecision: "approved" | "rejected" | null;
  approvalCount: number;
};
type SurfaceData = {
  brief: { authorizedContent: SurfaceBindings } & Record<string, unknown>;
  surface: { id: string; publishedRevisionId: string | null; publishedRevisionNumber: number | null; memberCount: number };
  history: Revision[];
};

export function RoomDesignClient({ roomId }: { roomId: string }) {
  const [data, setData] = useState<SurfaceData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const endpoint = `/api/rooms/${encodeURIComponent(roomId)}/surface`;

  const load = useCallback(async () => {
    setLoadError(false);
    try { const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json() as SurfaceData & { error?: string };
      if(!response.ok)throw new Error(userFacingError(body.error, "Room design history could not load."));
      setData(body);
    } catch(error){setNotice(error instanceof Error?error.message:"Room design history could not load.");setLoadError(true)}
  }, [endpoint]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mutate(payload: object, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(userFacingError(body.error, "That design change could not be saved."));
        return;
      }
      setNotice(success);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const designPrompt = data ? `Redesign my Buildmates room ${roomId}. Keep it lightweight and grounded in why we connected. Create a private preview for both members to review, but do not publish it.` : "";

  return <details className={styles.designWorkspace}>
    <summary>Redesign this room with Codex</summary>
    <div className={styles.designBody}>
      <p>Either member can propose a design. It stays a private preview until both people approve it; publishing never changes chat, membership, or permissions.</p>
      {notice && !loadError && <p role="status">{notice}</p>}
      {!data ? loadError?<div role="alert"><p>{notice}</p><button type="button" onClick={()=>void load()}>Try again</button></div>:<p role="status">Loading design history…</p> : <>
        <div className={styles.designActions}><a href={`codex://open?prompt=${encodeURIComponent(designPrompt)}`}>Design with Codex</a><button type="button" onClick={()=>void navigator.clipboard.writeText(designPrompt).then(()=>setNotice("Codex design prompt copied.")).catch(()=>setNotice("Copy was blocked. Select the prompt and copy it manually."))}>Copy Codex prompt</button></div>
        <h3>Private preview history</h3>
        <ol className={styles.designHistory}>
          {data.history.map((revision) => {
            const published = data.surface.publishedRevisionId === revision.id;
            const fullyApproved = revision.approvalCount >= data.surface.memberCount;
            const currentBase = revision.baseRevisionNumber === data.surface.publishedRevisionNumber;
            return <li key={revision.id}>
              <div>
                <strong>Revision {revision.revisionNumber}{published ? " · shared now" : ""}</strong>
                <span>By {revision.authorName} · {revision.approvalCount}/{data.surface.memberCount} approved</span>
              </div>
              {!published && <SurfaceRenderer spec={revision.spec} bindings={data.brief.authorizedContent} />}
              <div className={styles.designActions}>
                {!published && currentBase && <>
                  <button disabled={busy} onClick={() => mutate({ action: "decide", revisionId: revision.id, decision: "approved" }, "Preview approved.")}>{revision.myDecision === "approved" ? "Approved" : "Approve"}</button>
                  <button disabled={busy} onClick={() => mutate({ action: "decide", revisionId: revision.id, decision: "rejected" }, "Preview rejected.")}>Reject</button>
                  {fullyApproved && <button disabled={busy} onClick={() => mutate({ action: "publish", revisionId: revision.id, expectedPublishedRevisionNumber: data.surface.publishedRevisionNumber }, "Shared room design published.")}>Publish shared design</button>}
                </>}
                {!published && !currentBase && <button disabled={busy} onClick={() => mutate({ action: "restore", revisionId: revision.id }, "A new rollback preview was created for both members to approve.")}>Use as rollback preview</button>}
              </div>
            </li>;
          })}
        </ol>
      </>}
    </div>
  </details>;
}
