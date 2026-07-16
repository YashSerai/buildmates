"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
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
  surface: { publishedRevisionId: string | null; publishedRevisionNumber: number | null; memberCount: number };
  history: Revision[];
};

export function RoomDesignClient({ roomId }: { roomId: string }) {
  const [data, setData] = useState<SurfaceData | null>(null);
  const [spec, setSpec] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/rooms/${encodeURIComponent(roomId)}/surface`;

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json() as SurfaceData & { error?: string };
    if (response.ok) setData(body);
    else setNotice(body.error ?? "Room design history could not load.");
  }, [endpoint]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mutate(payload: object, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(body.error === "surface_conflict" ? "The shared design changed. Refresh the history before trying again." : (body.error ?? "That design change could not be saved."));
        return;
      }
      setNotice(success);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    try {
      await mutate({ action: "draft", spec: JSON.parse(spec) }, "Private preview created. Both room members can review it.");
      setSpec("");
    } catch {
      setNotice("Paste a complete JSON SurfaceSpec from Codex.");
    }
  }

  return <details className={styles.designWorkspace}>
    <summary>Redesign this room with Codex</summary>
    <div className={styles.designBody}>
      <p>Either member can propose a design. It stays a private preview until both people approve it; publishing never changes chat, membership, or permissions.</p>
      {notice && <p role="status">{notice}</p>}
      {!data ? <p>Loading design history…</p> : <>
        <details>
          <summary>Copy the authorized Codex generation brief</summary>
          <pre>{JSON.stringify(data.brief, null, 2)}</pre>
        </details>
        <label>SurfaceSpec JSON<textarea rows={12} value={spec} onChange={(event) => setSpec(event.target.value)} /></label>
        <button type="button" disabled={busy || !spec.trim()} onClick={createDraft}>Validate private preview</button>
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
