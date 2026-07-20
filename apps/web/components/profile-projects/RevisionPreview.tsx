"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { userFacingError } from "@/src/client/user-facing-error";
import { auditRenderedSurface, type RenderedSurfaceIssue } from "@/src/client/surface-quality";
import { ProfileProjectMedia } from "./ProfileProjectMedia";
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
    handle: string;
    authorizedContent: SurfaceBindings;
    authorizedMedia?: Array<{ key: string; altKey: string; approvedAssetIds: string[] }>;
    approvedAssets?: Array<{ id: string; src: string }>;
  } & Record<string, unknown>;
  publicPreviewContent: SurfaceBindings;
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
  const [qualityIssues, setQualityIssues] = useState<RenderedSurfaceIssue[] | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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
    ? `${data.surface.publishedRevisionId ? "Revise" : "Design"} my Buildmates profile using the Buildmates profile-design workflow for design ${data.surface.id}. ${data.surface.publishedRevisionId ? "Start from the current published revision. Ask what I want changed; for a small request use a targeted revision and preserve every unrelated node, binding, and theme area." : "Use my preferred local design skill if I have named one; otherwise use Hallmark. Privately study person-specific references, tell me the direction you are leaning toward and why, then create a private preview."} Before showing it, render the complete page at desktop and phone widths and repair weak hierarchy, filler or repeated content, unrelated decoration, dead space, overflow, clipping, contrast, legibility, and broken responsive behavior. Treat the result as a direction I can shape and invite honest feedback or a complete rethink. Do not publish without my explicit approval.`
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
  const publishedRevision = data?.history.find(
    (revision) => revision.id === data.surface.publishedRevisionId,
  );
  const activePreview = privatePreview ?? publishedRevision;
  const previewCanPublish = Boolean(
    privatePreview &&
      privatePreview.baseRevisionNumber === data?.surface.publishedRevisionNumber &&
      qualityIssues?.length === 0,
  );

  useEffect(() => {
    if (!activePreview || !previewRef.current) {
      setQualityIssues(null);
      return;
    }
    setQualityIssues(null);
    let cancelled = false;
    const run = () => {
      if (!cancelled && previewRef.current) setQualityIssues(auditRenderedSurface(previewRef.current));
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(run));
    void document.fonts?.ready.then(run);
    window.addEventListener("resize", run);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", run);
    };
  }, [activePreview]);

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
            <p className={styles.designQualityNote}>
              Codex checks the complete page on desktop and phone before you
              see it. The first direction is yours to shape: keep what feels
              right, change what does not, or ask for a complete rethink.
            </p>
          </div>
          {data ? (
            <div className={styles.designWorkspaceActions} aria-label="Profile design actions">
              <Link className={styles.quietAction} href="/profile/edit">
                Edit profile details
              </Link>
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
            <ProfileProjectMedia onChanged={load} />
            <section className={styles.previewWorkspace} aria-labelledby="profile-preview-title">
              <div className={styles.previewWorkspaceHeader}>
                <div>
                  <p className={styles.previewState}>{privatePreview ? "Private preview" : publishedRevision ? "Live design" : "No design yet"}</p>
                  <h2 id="profile-preview-title">{privatePreview ? "What visitors will see" : publishedRevision ? "Your published profile" : "Start your first design"}</h2>
                </div>
                {privatePreview ? <p>This preview uses the same public fields visitors receive.</p> : null}
              </div>

              {activePreview ? (
                <div className={styles.previewCanvas} ref={previewRef}>
                  <SurfaceRenderer
                    spec={activePreview.spec}
                    bindings={previewSurfaceBindings(data.brief, data.publicPreviewContent, activePreview.spec)}
                  />
                </div>
              ) : (
                <div className={styles.emptyPreview}>
                  <p>Codex will propose a direction from your approved profile, then build a private version here. You can refine it conversationally until it feels right.</p>
                </div>
              )}

              {activePreview ? (
                <div className={styles.currentDesignActions}>
                  {privatePreview && previewCanPublish ? (
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
                  ) : privatePreview ? (
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
                  ) : (
                    <>
                      <Link className={styles.primaryAction} href={`/builders/${data.brief.handle}`}>Open public profile</Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            { action: "restore", revisionId: activePreview.id },
                            "A private revision was created from your live design.",
                          )
                        }
                      >
                        Edit this design
                      </button>
                    </>
                  )}
                  {privatePreview && qualityIssues?.length ? (
                    <span role="alert">Fix {qualityIssues.length} visual {qualityIssues.length === 1 ? "issue" : "issues"} before publishing: {qualityIssues[0].message}</span>
                  ) : privatePreview && qualityIssues === null ? (
                    <span>Checking the complete rendered page before publication.</span>
                  ) : privatePreview ? (
                    <span>Publishing replaces the page people see at your public profile link.</span>
                  ) : (
                    <span>Editing creates a private revision. Your live page stays unchanged until you publish again.</span>
                  )}
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
                    const currentPrivatePreview = revision.id === privatePreview?.id;
                    const label = published
                      ? "Published"
                      : currentPrivatePreview
                        ? "Current private preview"
                        : `Private version ${revision.revisionNumber}`;
                    return (
                      <li key={revision.id}>
                        <p><strong>{label}</strong><span>{new Date(revision.createdAt).toLocaleDateString()}</span></p>
                        {published ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                { action: "restore", revisionId: revision.id },
                                "A private revision was created from your live design.",
                              )
                            }
                          >
                            Edit a copy
                          </button>
                        ) : !currentPrivatePreview ? (
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

function previewSurfaceBindings(brief: Data["brief"], publicContent: SurfaceBindings, spec: unknown): SurfaceBindings {
  const bindings: Record<string, SurfaceBindings[string]> = { ...publicContent };
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
    const alt = publicContent[media.altKey];
    if (!assetId || typeof alt !== "string" || !alt.trim()) continue;
    bindings[media.key] = { assetId, alt };
  }
  return bindings;
}
