import React, { type CSSProperties, type ReactNode } from "react";
import { sanitizeDecorativeRegion, type SanitizedDecorativeRegion } from "./sanitize";
import { safeParseSurfaceSpec, type SurfaceNode, type SurfaceSpec } from "./schema";

export type SurfaceFact = { label: string; value: string };
export type SurfaceProject = { id: string; title: string; summary: string; href?: string };
export type SurfaceMedia = { assetId: string; alt: string };
export type SurfaceBinding = string | readonly string[] | readonly SurfaceFact[] | readonly SurfaceProject[] | SurfaceMedia | null;
export type SurfaceBindings = Readonly<Record<string, SurfaceBinding | undefined>>;
export type SurfaceAction = "connect" | "follow" | "report" | "privacy" | "navigate";

export type SurfaceRendererProps = {
  spec: SurfaceSpec | unknown;
  bindings: SurfaceBindings;
  onAction?: (action: SurfaceAction, id: string) => void;
  state?: "ready" | "loading" | "empty" | "error" | "stale" | "permission";
  className?: string;
};

export function SurfaceRendererCore({ spec: input, bindings, onAction, state = "ready", className = "" }: SurfaceRendererProps) {
  const parsed = safeParseSurfaceSpec(input);
  const spec = parsed.success ? parsed.data : null;
  const shell = spec ?? SAFE_SHELL;
  const style = {
    "--surface-canvas": shell.theme.colors.canvas,
    "--surface-panel": shell.theme.colors.surface,
    "--surface-ink": shell.theme.colors.ink,
    "--surface-muted": shell.theme.colors.mutedInk,
    "--surface-accent": shell.theme.colors.accent,
    "--surface-accent-ink": shell.theme.colors.accentInk,
    "--surface-rule": shell.theme.colors.rule,
    "--surface-focus-inner": shell.theme.colors.focusInner,
    "--surface-focus-outer": shell.theme.colors.focusOuter,
  } as CSSProperties;
  const shellClassName = `surface-root surface-mode-${shell.theme.mode} surface-width-${shell.responsive.contentWidth} surface-pad-${shell.responsive.edgePadding} surface-density-${shell.theme.shape.density} surface-corners-${shell.theme.shape.corners} surface-display-${shell.theme.typography.display} surface-body-${shell.theme.typography.body} surface-scale-${shell.theme.typography.scale} ${className}`;
  const wrap = (content: ReactNode, surfaceState: string) => <article aria-label={spec?.accessibility.label ?? "Buildmates surface"} className={shellClassName} data-collapse-below={shell.responsive.collapseGridsBelow} data-surface-state={surfaceState} style={style}>{content}</article>;
  if (state !== "ready") return wrap(<SurfaceState state={state} />, state);
  if (!spec) return wrap(<SurfaceFallback title="This surface could not be displayed" detail="The saved design is invalid. Buildmates kept the trusted fallback instead." />, "malformed");
  let sanitizedRegions: Map<string, SanitizedDecorativeRegion>;
  try {
    sanitizedRegions = new Map(spec.decorativeRegions.map((region) => [region.id, sanitizeDecorativeRegion(region)]));
  } catch {
    return wrap(<SurfaceFallback title="This surface was blocked" detail="Unsafe decorative code was removed before it reached your browser." />, "blocked");
  }
  return wrap(<Node node={spec.root} spec={spec} bindings={bindings} regions={sanitizedRegions} onAction={onAction} />, "ready");
}

const SAFE_SHELL = {
  theme: {
    mode: "light" as const,
    colors: { canvas: "#ffffff", surface: "#f5f5f2", ink: "#171814", mutedInk: "#50534b", accent: "#c7d3aa", accentInk: "#181b12", rule: "#b9bcb2", focusInner: "#000000", focusOuter: "#ffffff" },
    typography: { display: "editorial" as const, body: "humanist" as const, scale: "comfortable" as const },
    shape: { corners: "soft" as const, density: "comfortable" as const },
  },
  responsive: { collapseGridsBelow: "md" as const, contentWidth: "standard" as const, edgePadding: "comfortable" as const },
};

function Node({ node, spec, bindings, regions, onAction }: { node: SurfaceNode; spec: SurfaceSpec; bindings: SurfaceBindings; regions: ReadonlyMap<string, SanitizedDecorativeRegion>; onAction?: SurfaceRendererProps["onAction"] }): ReactNode {
  switch (node.type) {
    case "section":
      return <section className={`surface-section surface-tone-${node.tone}`}>{node.children.map((child) => <Node key={child.id} node={child} spec={spec} bindings={bindings} regions={regions} onAction={onAction} />)}</section>;
    case "stack":
      return <div className={`surface-stack surface-gap-${node.gap} surface-align-${node.align}`}>{node.children.map((child) => <Node key={child.id} node={child} spec={spec} bindings={bindings} regions={regions} onAction={onAction} />)}</div>;
    case "grid":
      return <div className={`surface-grid surface-grid-${node.columns} surface-gap-${node.gap}`}>{node.children.map((child) => <Node key={child.id} node={child} spec={spec} bindings={bindings} regions={regions} onAction={onAction} />)}</div>;
    case "heading": {
      const value = textBinding(bindings[node.binding], node.fallback);
      return React.createElement(`h${node.level}`, { className: `surface-heading surface-heading-${node.level}` }, value);
    }
    case "text":
      return <p className={`surface-text surface-text-${node.style}`}>{textBinding(bindings[node.binding], node.fallback)}</p>;
    case "fact-list": {
      const facts = bindings[node.binding];
      if (!isFactList(facts) || facts.length === 0) return <p className="surface-empty">{node.emptyMessage}</p>;
      return <dl className="surface-facts">{facts.map((fact, index) => <div key={`${fact.label}-${index}`} className="surface-fact"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;
    }
    case "project-list": {
      const projects = bindings[node.binding];
      if (!isProjectList(projects) || projects.length === 0) return <p className="surface-empty">{node.emptyMessage}</p>;
      return <div className="surface-projects">{projects.map((project) => <article className="surface-project" key={project.id}><p className="surface-project-title">{project.title}</p><p>{project.summary}</p>{project.href && isTrustedHref(project.href) ? <a href={project.href}>Open project <span aria-hidden="true">↗</span></a> : null}</article>)}</div>;
    }
    case "media": {
      const media = bindings[node.binding];
      const separateAlt = textBinding(bindings[node.altBinding], "");
      if (!isMedia(media)) return <div className={`surface-media surface-media-${node.aspect}`} role="img" aria-label="Media unavailable" />;
      const declaration = spec.bindingManifest.media.find((item) => item.key === node.binding);
      const asset = spec.approvedAssets.find((item) => item.id === media.assetId);
      if (!declaration?.approvedAssetIds.includes(media.assetId) || !asset || !(separateAlt || media.alt)) return <div className={`surface-media surface-media-${node.aspect}`} role="img" aria-label="Media unavailable" />;
      return <figure className={`surface-media surface-media-${node.aspect}`}>
        {/* Framework-neutral renderer; src is restricted to the passive R2 asset route above. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.src} alt={separateAlt || media.alt} loading="lazy" />
      </figure>;
    }
    case "callout":
      return <aside className="surface-callout"><strong>{textBinding(bindings[node.titleBinding], "Worth noting")}</strong><p>{textBinding(bindings[node.bodyBinding], "No shared note is available yet.")}</p></aside>;
    case "action-row":
      return <div className="surface-actions" aria-label="Surface actions">{node.actions.map((item) => <div className="surface-action" key={item.id}><button type="button" data-action={item.action} disabled={!onAction} onClick={() => onAction?.(item.action, item.id)} title={onAction ? undefined : "This action is unavailable in preview"}>{TRUSTED_ACTION_LABELS[item.action]}</button>{item.supportingCopy ? <span>{item.supportingCopy}</span> : null}</div>)}</div>;
    case "decorative-region": {
      const region = regions.get(node.regionId);
      const credentialless = { credentialless: "" } as React.IframeHTMLAttributes<HTMLIFrameElement> & { credentialless: string };
      return region ? <iframe {...credentialless} className={`surface-decoration surface-decoration-${node.height}`} title={region.label} sandbox="" referrerPolicy="no-referrer" srcDoc={region.srcDoc} /> : null;
    }
  }
}

function SurfaceState({ state }: { state: Exclude<SurfaceRendererProps["state"], "ready" | undefined> }) {
  const content = {
    loading: ["Loading this surface", "The latest approved revision is being prepared."],
    empty: ["Nothing has been placed here yet", "The builder can publish a first revision when they are ready."],
    error: ["The surface is unavailable", "Try again after the connection is restored."],
    stale: ["A newer revision is available", "Refresh before approving or publishing changes."],
    permission: ["This surface is private", "Only approved members can view this revision."],
  }[state];
  return <div className={`surface-state surface-state-${state}`} role={state === "error" ? "alert" : "status"} aria-live="polite"><strong>{content[0]}</strong><p>{content[1]}</p>{state === "loading" ? <div className="surface-loading-track" aria-hidden="true"><span /></div> : null}</div>;
}

function SurfaceFallback({ title, detail }: { title: string; detail: string }) {
  return <div className="surface-fallback" role="alert"><strong>{title}</strong><p>{detail}</p></div>;
}

function textBinding(value: SurfaceBinding | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.slice(0, 2_000) : fallback;
}
function isFactList(value: SurfaceBinding | undefined): value is readonly SurfaceFact[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && typeof item.label === "string" && typeof item.value === "string");
}
function isProjectList(value: SurfaceBinding | undefined): value is readonly SurfaceProject[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.title === "string" && typeof item.summary === "string");
}
function isMedia(value: SurfaceBinding | undefined): value is SurfaceMedia {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "assetId" in value && "alt" in value && typeof value.assetId === "string" && typeof value.alt === "string";
}
function isTrustedHref(path: string): boolean {
  return /^\/(?:projects|builders|rooms|circles)\/[a-z0-9_-]+(?:\?[a-z0-9_=&-]+)?$/i.test(path);
}

export const TRUSTED_ACTION_LABELS: Readonly<Record<SurfaceAction, string>> = {
  connect: "Connect",
  follow: "Follow public work",
  report: "Report",
  privacy: "Privacy settings",
  navigate: "Open conversation",
};
