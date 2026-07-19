"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./ProductForms.module.css";

type Revision = {
  id: string;
  revisionNumber: number;
  baseRevisionNumber: number | null;
  status: string;
  spec: unknown;
  createdAt: number;
};
type Data = {
  brief: {
    authorizedContent: SurfaceBindings;
    authorizedMedia?: Array<{ key: string; altKey: string; approvedAssetIds: string[] }>;
    approvedAssets?: Array<{ id: string; src: string }>;
  } & Record<string, unknown>;
  surface: {
    id: string;
    publishedRevisionId: string | null;
    publishedRevisionNumber: number | null;
  };
  history: Revision[];
};

export function RevisionPreview() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch("/api/surfaces/profile", {
        cache: "no-store",
      });
      const value = (await response.json()) as Data & { error?: string };
      if (!response.ok) {
        throw new Error(
          userFacingError(value.error, "Design workspace could not load."),
        );
      }
      setData(value);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Design workspace could not load.",
      );
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function mutate(payload: object, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/surfaces/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const value = (await response.json()) as { error?: string };
      setMessage(
        response.ok
          ? success
          : userFacingError(value.error, "That design change could not be saved."),
      );
      if (response.ok) await load();
      return response.ok;
    } finally {
      setBusy(false);
    }
  }

  const designPrompt = data
    ? `Redesign my Buildmates profile using the Buildmates profile-design workflow for design ${data.surface.id}. Create a private preview for me to review. Do not publish without my explicit approval.`
    : "";
  async function copyDesignPrompt() {
    try {
      await navigator.clipboard.writeText(designPrompt);
      setMessage("Codex design prompt copied.");
    } catch {
      setMessage("Copy was blocked. Use Design with Codex instead.");
    }
  }

  const privatePreview = data?.history.find(
    (revision) => revision.id !== data.surface.publishedRevisionId,
  );
  const previewCanPublish = Boolean(
    privatePreview &&
      privatePreview.baseRevisionNumber === data?.surface.publishedRevisionNumber,
  );

  return (
    <main className={`${styles.form} ${styles.designWorkspace}`}>
      <div className={styles.designWorkspaceInner}>
        <header className={styles.designWorkspaceHeader}>
          <div className={styles.designWorkspaceIntro}>
            <p className={styles.eyebrow}>Profile design</p>
            <h1>Make your page feel like you.</h1>
            <p>
              Ask Codex to turn your approved profile into a page with its own
              layout, typography, color, and rhythm. You review every version
              before it goes live.
            </p>
          </div>
          {data ? (
            <div className={styles.designWorkspaceActions} aria-label="Profile design actions">
              <a
                className={styles.primaryAction}
                href={`codex://open?prompt=${encodeURIComponent(designPrompt)}`}
              >
                Design with Codex
              </a>
              <button className={styles.quietAction} type="button" onClick={copyDesignPrompt}>
                Copy prompt
              </button>
            </div>
          ) : null}
        </header>

        {message && !loadError ? <p className={styles.designStatus} role="status">{message}</p> : null}
        {!data ? (
          loadError ? (
            <div className={styles.designLoadState} role="alert">
              <p>{message}</p>
              <button type="button" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : (
            <p className={styles.designLoadState} role="status">Loading your designs...</p>
          )
        ) : (
          <>
            <section className={styles.previewWorkspace} aria-labelledby="profile-preview-title">
              <div className={styles.previewWorkspaceHeader}>
                <div>
                  <p className={styles.previewState}>{privatePreview ? "Private" : "No draft"}</p>
                  <h2 id="profile-preview-title">{privatePreview ? "Your latest preview" : "Start your first design"}</h2>
                </div>
                {privatePreview ? <p>Only you can see this version.</p> : null}
              </div>

              {privatePreview ? (
                <div className={styles.previewCanvas}>
                  <SurfaceRenderer
                    spec={privatePreview.spec}
                    bindings={previewSurfaceBindings(data.brief, privatePreview.spec)}
                  />
                </div>
              ) : (
                <div className={styles.emptyPreview}>
                  <p>Tell Codex how the page should feel. It will build a private version here for you to review.</p>
                </div>
              )}

              {privatePreview ? (
                <div className={styles.currentDesignActions}>
                  {previewCanPublish ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          {
                            action: "publish",
                            revisionId: privatePreview.id,
                            expectedPublishedRevisionNumber:
                              data.surface.publishedRevisionNumber,
                          },
                          "Profile design published.",
                        )
                      }
                    >
                      Publish this design
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          { action: "restore", revisionId: privatePreview.id },
                          "A new private preview was created from that design.",
                        )
                      }
                    >
                      Update this preview
                    </button>
                  )}
                  <span>Publishing replaces the page people see at your public profile link.</span>
                </div>
              ) : null}
            </section>

            <section className={styles.historySection} aria-labelledby="design-history-title">
              <div className={styles.historyHeader}>
                <h2 id="design-history-title">Design history</h2>
                <p>{data.history.length ? `${data.history.length} saved ${data.history.length === 1 ? "version" : "versions"}` : "No saved versions"}</p>
              </div>
              {data.history.length ? (
                <ol className={styles.designHistory}>
                  {data.history.map((revision) => {
                    const published = data.surface.publishedRevisionId === revision.id;
                    const activePreview = revision.id === privatePreview?.id;
                    const label = published
                      ? "Published"
                      : activePreview
                        ? "Current private preview"
                        : `Private version ${revision.revisionNumber}`;
                    return (
                      <li key={revision.id}>
                        <p><strong>{label}</strong><span>{new Date(revision.createdAt).toLocaleDateString()}</span></p>
                        {!published && !activePreview ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                { action: "restore", revisionId: revision.id },
                                "A new private preview was created from that design.",
                              )
                            }
                          >
                            Preview again
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className={styles.historyEmpty}>Your saved designs will appear here.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function previewSurfaceBindings(brief: Data["brief"], spec: unknown): SurfaceBindings {
  const bindings: Record<string, SurfaceBindings[string]> = { ...brief.authorizedContent };
  if (!spec || typeof spec !== "object" || !Array.isArray(brief.authorizedMedia) || !Array.isArray(brief.approvedAssets)) return bindings;
  const candidate = spec as { approvedAssets?: unknown; bindingManifest?: { media?: unknown } };
  if (!Array.isArray(candidate.approvedAssets) || !Array.isArray(candidate.bindingManifest?.media)) return bindings;
  const specAssets = new Map(candidate.approvedAssets.flatMap((asset) => {
    if (!asset || typeof asset !== "object") return [];
    const value = asset as { id?: unknown; src?: unknown };
    return typeof value.id === "string" && typeof value.src === "string" ? [[value.id, value.src] as const] : [];
  }));
  const briefAssets = new Map(brief.approvedAssets.map((asset) => [asset.id, asset.src]));
  const declarations = candidate.bindingManifest.media.filter((item): item is { key: string; altKey: string; approvedAssetIds: string[] } => {
    if (!item || typeof item !== "object") return false;
    const value = item as { key?: unknown; altKey?: unknown; approvedAssetIds?: unknown };
    return typeof value.key === "string" && typeof value.altKey === "string" && Array.isArray(value.approvedAssetIds) && value.approvedAssetIds.every((id) => typeof id === "string");
  });
  for (const media of brief.authorizedMedia) {
    const declaration = declarations.find((item) => item.key === media.key && item.altKey === media.altKey);
    const assetId = declaration?.approvedAssetIds.find((id) => media.approvedAssetIds.includes(id) && specAssets.get(id) === briefAssets.get(id));
    const alt = brief.authorizedContent[media.altKey];
    if (!assetId || typeof alt !== "string" || !alt.trim()) continue;
    bindings[media.key] = { assetId, alt };
  }
  return bindings;
}
