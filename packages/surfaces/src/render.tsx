import React, { type CSSProperties, type ReactNode } from "react";
import { sanitizeDecorativeRegion, type SanitizedDecorativeRegion } from "./sanitize";
import { SURFACE_V2_STYLES } from "./render-styles";
import { safeParseSurfaceSpec, SURFACE_FONT_REGISTRY, type Placement, type SurfaceNode, type SurfaceSpec } from "./schema";
import { renderGeneratedSite } from "./generated-site";

export type SurfaceFact = { label: string; value: string };
export type SurfaceProject = { id: string; title: string; summary: string; href?: string; tags?: readonly string[]; metrics?: readonly SurfaceFact[] };
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
  if (spec?.schemaVersion === "3") {
    if (state !== "ready") return <article className={className} data-surface-state={state}><SurfaceState state={state} /></article>;
    const srcDoc = safeGeneratedSiteDocument({ html: spec.document.html, css: spec.document.css, bindings, approvedAssetSources: spec.approvedAssets.map((asset) => asset.src) });
    if (!srcDoc) return <article className={className} data-surface-state="blocked"><SurfaceFallback title="This design was blocked" detail="Buildmates kept unsafe generated code out of your profile." /></article>;
    return <iframe
        aria-label={spec.accessibility.label}
        className={`surface-generated-site ${className}`}
        data-surface-kind={spec.kind}
        data-surface-state="ready"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
    />;
  }
  const shell = spec ?? SAFE_SHELL;
  const colors = shell.theme.colors;
  const style = {
    "--surface-canvas": colors.canvas,
    "--surface-panel": colors.surface,
    "--surface-ink": colors.ink,
    "--surface-muted": colors.mutedInk,
    "--surface-accent": colors.accent,
    "--surface-accent-ink": colors.accentInk,
    "--surface-secondary": "secondary" in colors ? colors.secondary : colors.surface,
    "--surface-secondary-ink": "secondaryInk" in colors ? colors.secondaryInk : colors.ink,
    "--surface-highlight": "highlight" in colors ? colors.highlight : colors.accent,
    "--surface-highlight-ink": "highlightInk" in colors ? colors.highlightInk : colors.accentInk,
    "--surface-rule": colors.rule,
    "--surface-focus-inner": colors.focusInner,
    "--surface-focus-outer": colors.focusOuter,
    ...(spec?.schemaVersion === "2" ? {
      "--surface-display-font": SURFACE_FONT_REGISTRY[spec.theme.typography.display],
      "--surface-body-font": SURFACE_FONT_REGISTRY[spec.theme.typography.body],
      "--surface-data-font": SURFACE_FONT_REGISTRY[spec.theme.typography.data],
      "--surface-motion-duration": `${spec.theme.motion.durationMs}ms`,
      "--surface-motion-iterations": spec.theme.motion.iterations,
    } : {}),
  } as CSSProperties;
  const versionClasses = spec?.schemaVersion === "2"
    ? `surface-v2 surface-atmosphere-${spec.theme.atmosphere.motif} surface-atmosphere-${spec.theme.atmosphere.density} surface-atmosphere-tone-${spec.theme.atmosphere.tone} surface-atmosphere-${spec.theme.atmosphere.continuity} surface-motion-${spec.theme.motion.preset} surface-border-${spec.theme.shape.border} surface-heading-weight-${spec.theme.typography.headingWeight} surface-heading-case-${spec.theme.typography.headingCase} surface-letter-${spec.theme.typography.letterSpacing}`
    : "surface-v1";
  const shellClassName = `surface-root ${versionClasses} surface-mode-${shell.theme.mode} surface-width-${shell.responsive.contentWidth} surface-pad-${shell.responsive.edgePadding} surface-density-${shell.theme.shape.density} surface-corners-${shell.theme.shape.corners} surface-display-${shell.theme.typography.display} surface-body-${shell.theme.typography.body} surface-scale-${shell.theme.typography.scale} ${className}`;
  const wrap = (content: ReactNode, surfaceState: string) => (
    <article
      aria-label={spec?.accessibility.label ?? "Buildmates surface"}
      className={shellClassName}
      data-collapse-below={shell.responsive.collapseGridsBelow}
      data-hero-stack-below={spec?.schemaVersion === "2" ? spec.responsive.heroStackBelow : undefined}
      data-surface-kind={spec?.kind}
      data-surface-state={surfaceState}
      style={style}
    >
      {spec?.schemaVersion === "2" ? <style>{SURFACE_V2_STYLES}</style> : null}
      {content}
    </article>
  );
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

function safeGeneratedSiteDocument(input: Parameters<typeof renderGeneratedSite>[0]) {
  try { return renderGeneratedSite(input); } catch { return null; }
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

type NodeProps = { node: SurfaceNode; spec: SurfaceSpec; bindings: SurfaceBindings; regions: ReadonlyMap<string, SanitizedDecorativeRegion>; onAction?: SurfaceRendererProps["onAction"] };

function Children({ node, spec, bindings, regions, onAction }: NodeProps & { node: SurfaceNode & { children: unknown } }) {
  const children = node.children as readonly SurfaceNode[];
  return <>{children.map((child) => <Node key={child.id} node={child} spec={spec} bindings={bindings} regions={regions} onAction={onAction} />)}</>;
}

function Node(props: NodeProps): ReactNode {
  const { node, spec, bindings, regions, onAction } = props;
  switch (node.type) {
    case "section": {
      const v2 = "layout" in node;
      const classes = v2 ? ` surface-section-${node.layout} surface-pad-block-${node.padding} surface-min-${node.minHeight} surface-bg-${node.background} surface-bg-opacity-${node.backgroundMediaOpacity} surface-bg-focus-${node.backgroundMediaFocalPoint}${node.bleed ? " surface-bleed" : ""}` : "";
      const backgroundStyle = v2 ? approvedBackgroundStyle(spec, bindings, node.backgroundMediaBinding) : undefined;
      return <section className={`surface-section surface-tone-${node.tone}${classes}`} style={backgroundStyle}><Children {...props} node={node} /></section>;
    }
    case "container":
      return <div className={`surface-container surface-container-${node.width} surface-container-${node.align} surface-pad-frame-${node.padding}`}><Children {...props} node={node} /></div>;
    case "canvas":
      return <div className={`surface-canvas surface-canvas-${node.minHeight}${node.clip ? " surface-canvas-clip" : ""}`} style={{ "--surface-canvas-rows": node.rows } as CSSProperties}><Children {...props} node={node} /></div>;
    case "layer":
      return <div className={`surface-layer surface-layer-overlap-${node.overlap} ${placementClasses(node.placement.desktop, "d")} ${placementClasses(node.placement.tablet, "t")} ${placementClasses(node.placement.phone, "p")}`} style={placementStyle(node.placement)}><Children {...props} node={node} /></div>;
    case "stack": {
      const v2 = "width" in node;
      return <div className={`surface-stack surface-gap-${node.gap} surface-align-${node.align}${v2 ? ` surface-justify-${node.justify} surface-stack-width-${node.width}` : ""}`}><Children {...props} node={node} /></div>;
    }
    case "grid": {
      const v2 = "layout" in node;
      return <div className={`surface-grid surface-grid-${node.columns} surface-gap-${node.gap}${v2 ? ` surface-grid-layout-${node.layout} surface-grid-align-${node.align}` : ""}`}><Children {...props} node={node} /></div>;
    }
    case "split":
      return <div className={`surface-split surface-split-${node.ratio} surface-gap-${node.gap} surface-grid-align-${node.align}${node.reverseOnMobile ? " surface-split-reverse" : ""}`}><Children {...props} node={node} /></div>;
    case "cluster":
      return <div className={`surface-cluster surface-gap-${node.gap} surface-align-${node.align} surface-justify-${node.justify}`}><Children {...props} node={node} /></div>;
    case "frame":
      return <div className={`surface-frame surface-tone-${node.tone} surface-pad-frame-${node.padding} surface-frame-border-${node.border} surface-elevation-${node.elevation} surface-rotate-${node.rotation} surface-span-${node.span}`}><Children {...props} node={node} /></div>;
    case "heading": {
      const value = textBinding(bindings[node.binding], node.fallback);
      const v2 = "size" in node;
      return React.createElement(`h${node.level}`, { className: `surface-heading surface-heading-${node.level}${v2 ? ` surface-heading-size-${node.size} surface-text-align-${node.align} surface-heading-width-${node.width} surface-weight-${node.weight} surface-leading-${node.lineHeight} surface-tracking-${node.tracking}` : ""}` }, value);
    }
    case "text": {
      const v2 = "width" in node;
      return <p className={`surface-text surface-text-${node.style}${v2 ? ` surface-text-align-${node.align} surface-text-width-${node.width} surface-weight-${node.weight} surface-leading-${node.lineHeight} surface-tracking-${node.tracking}` : ""}`}>{textBinding(bindings[node.binding], node.fallback)}</p>;
    }
    case "fact-list": {
      const facts = bindings[node.binding];
      if (!isFactList(facts) || facts.length === 0) return emptyCollection(spec, node.emptyMessage);
      const v2 = "layout" in node;
      return <dl className={`surface-facts${v2 ? ` surface-facts-${node.layout} surface-facts-${node.emphasis}` : ""}`}>{facts.map((fact, index) => <div key={`${fact.label}-${index}`} className="surface-fact"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;
    }
    case "tag-list": {
      const tags = bindings[node.binding];
      if (!isStringList(tags) || tags.length === 0) return emptyCollection(spec, node.emptyMessage);
      return <ul className={`surface-tags surface-tags-${node.style}`}>{tags.slice(0, 40).map((tag, index) => <li key={`${tag}-${index}`}>{tag}</li>)}</ul>;
    }
    case "project-list": {
      const projects = bindings[node.binding];
      if (!isProjectList(projects) || projects.length === 0) return emptyCollection(spec, node.emptyMessage);
      const v2 = "layout" in node;
      return <div className={`surface-projects${v2 ? ` surface-projects-${node.layout} surface-project-columns-${node.columns}` : ""}`}>{projects.map((project, index) => <article className="surface-project" key={project.id}><span className="surface-project-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><p className="surface-project-title">{project.title}</p><p>{project.summary}</p>{project.href && isTrustedHref(project.href) ? <a href={project.href}>Open project <span aria-hidden="true">↗</span></a> : null}</article>)}</div>;
    }
    case "featured-project": {
      const projects = bindings[node.binding];
      const project = isProjectList(projects) ? projects[node.index] : undefined;
      if (!project) return spec.kind === "profile" ? null : <p className="surface-empty">Featured project unavailable</p>;
      return <article className={`surface-featured-project surface-featured-project-${node.layout}`}><span className="surface-project-index" aria-hidden="true">{String(node.index + 1).padStart(2, "0")}</span><div className="surface-featured-project-copy"><h3>{project.title}</h3><p>{project.summary}</p>{node.showTags && project.tags?.length ? <ul className="surface-tags surface-tags-plain">{project.tags.slice(0, 8).map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}{node.showMetrics && project.metrics?.length ? <dl className="surface-facts surface-facts-inline">{project.metrics.slice(0, 6).map((fact) => <div className="surface-fact" key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}{project.href && isTrustedHref(project.href) ? <a href={project.href}>Open project <span aria-hidden="true">↗</span></a> : null}</div></article>;
    }
    case "project-artifact": {
      const projects = bindings[node.binding];
      const project = isProjectList(projects) ? projects[node.index] : undefined;
      if (!project) return null;
      const tags = project.tags?.slice(0, 4) ?? [];
      return <figure className={`surface-project-artifact surface-project-artifact-${node.variant} surface-project-artifact-${node.scale} surface-tone-${node.tone}`}>
        <div className="surface-project-artifact-stage" aria-hidden="true">
          <span className="surface-project-artifact-index">{String(node.index + 1).padStart(2, "0")}</span>
          <span className="surface-project-artifact-title">{project.title}</span>
          <span className="surface-project-artifact-line surface-project-artifact-line-a" />
          <span className="surface-project-artifact-line surface-project-artifact-line-b" />
          <span className="surface-project-artifact-line surface-project-artifact-line-c" />
          {tags.map((tag, index) => <span className={`surface-project-artifact-tag surface-project-artifact-tag-${index + 1}`} key={tag}>{tag}</span>)}
        </div>
        <figcaption>{project.title}</figcaption>
      </figure>;
    }
    case "media": {
      const v2 = "fit" in node;
      return renderMedia(spec, bindings, node.binding, node.altBinding, `surface-media surface-media-${node.aspect}${v2 ? ` surface-media-fit-${node.fit} surface-media-focus-${node.focalPoint} surface-media-${node.treatment}` : ""}`);
    }
    case "gallery":
      return <div className={`surface-gallery surface-gallery-${node.layout} surface-gallery-columns-${node.columns} surface-media-${node.treatment}`}>{node.items.map((item) => <React.Fragment key={`${item.binding}-${item.altBinding}`}>{renderMedia(spec, bindings, item.binding, item.altBinding, "surface-gallery-item")}</React.Fragment>)}</div>;
    case "callout": {
      const v2 = "variant" in node;
      return <aside className={`surface-callout${v2 ? ` surface-callout-${node.variant} surface-tone-${node.tone}` : ""}`}><strong>{textBinding(bindings[node.titleBinding], "Worth noting")}</strong><p>{textBinding(bindings[node.bodyBinding], "No shared note is available yet.")}</p></aside>;
    }
    case "divider":
      return <hr className={`surface-divider surface-divider-${node.style}`} />;
    case "spacer":
      return <div className={`surface-spacer surface-spacer-${node.size}`} aria-hidden="true" />;
    case "decorative-mark":
      return <span className={`surface-mark surface-mark-${node.mark} surface-mark-${node.size} surface-mark-${node.position} surface-mark-tone-${node.tone}`} aria-hidden="true" />;
    case "motif-line":
      return <span className={`surface-motif-line surface-motif-line-${node.path} surface-motif-line-${node.weight} surface-motif-line-${node.span} surface-mark-tone-${node.tone}`} aria-hidden="true" />;
    case "action-row":
      if (!onAction) return null;
      return <div className="surface-actions" aria-label="Surface actions">{node.actions.map((item) => <div className="surface-action" key={item.id}><button type="button" data-action={item.action} onClick={() => onAction(item.action, item.id)}>{TRUSTED_ACTION_LABELS[item.action]}</button>{item.supportingCopy ? <span>{item.supportingCopy}</span> : null}</div>)}</div>;
    case "action-slot":
      if (!onAction) return null;
      return <div className={`surface-actions surface-action-slot-${node.placement}`} aria-label="Surface actions">{node.actions.map((item) => <div className="surface-action" key={item.id}><button type="button" data-action={item.action} onClick={() => onAction(item.action, item.id)}>{TRUSTED_ACTION_LABELS[item.action]}</button>{item.supportingCopy ? <span>{item.supportingCopy}</span> : null}</div>)}</div>;
    case "decorative-region": {
      const region = regions.get(node.regionId);
      const credentialless = { credentialless: "" } as React.IframeHTMLAttributes<HTMLIFrameElement> & { credentialless: string };
      return region ? <iframe {...credentialless} className={`surface-decoration surface-decoration-${node.height}`} title={region.label} sandbox="" referrerPolicy="no-referrer" srcDoc={region.srcDoc} /> : null;
    }
  }
}

function emptyCollection(spec: SurfaceSpec, message: string): ReactNode {
  if (spec.kind === "profile" || !message.trim()) return null;
  return <p className="surface-empty">{message}</p>;
}

function renderMedia(spec: SurfaceSpec, bindings: SurfaceBindings, binding: string, altBinding: string, className: string): ReactNode {
  const media = bindings[binding];
  const separateAlt = textBinding(bindings[altBinding], "");
  if (!isMedia(media)) return <div className={className} role="img" aria-label="Media unavailable" />;
  const declaration = spec.bindingManifest.media.find((item) => item.key === binding);
  const asset = spec.approvedAssets.find((item) => item.id === media.assetId);
  if (!declaration?.approvedAssetIds.includes(media.assetId) || !asset || !(separateAlt || media.alt)) return <div className={className} role="img" aria-label="Media unavailable" />;
  return <figure className={className}>
    {/* Framework-neutral renderer; src is restricted to the passive R2 asset route above. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={asset.src} alt={separateAlt || media.alt} loading="lazy" />
  </figure>;
}

function approvedBackgroundStyle(spec: SurfaceSpec, bindings: SurfaceBindings, binding: string | null): CSSProperties | undefined {
  if (!binding) return undefined;
  const media = bindings[binding];
  if (!isMedia(media)) return undefined;
  const declaration = spec.bindingManifest.media.find((item) => item.key === binding);
  const asset = spec.approvedAssets.find((item) => item.id === media.assetId);
  if (!declaration?.approvedAssetIds.includes(media.assetId) || !asset) return undefined;
  return { "--surface-background-image": `url("${asset.src}")` } as CSSProperties;
}

function placementClasses(placement: Placement, breakpoint: "d" | "t" | "p"): string {
  return `surface-layer-${breakpoint}-align-${placement.align} surface-layer-${breakpoint}-x-${placement.offsetX} surface-layer-${breakpoint}-y-${placement.offsetY}`;
}

function placementStyle(placement: { desktop: Placement; tablet: Placement; phone: Placement }): CSSProperties {
  return {
    "--surface-d-column": placement.desktop.columnStart,
    "--surface-d-span": placement.desktop.columnSpan,
    "--surface-d-row": placement.desktop.rowStart,
    "--surface-d-row-span": placement.desktop.rowSpan,
    "--surface-d-order": placement.desktop.order,
    "--surface-t-column": placement.tablet.columnStart,
    "--surface-t-span": placement.tablet.columnSpan,
    "--surface-t-row": placement.tablet.rowStart,
    "--surface-t-row-span": placement.tablet.rowSpan,
    "--surface-t-order": placement.tablet.order,
    "--surface-p-column": placement.phone.columnStart,
    "--surface-p-span": placement.phone.columnSpan,
    "--surface-p-row": placement.phone.rowStart,
    "--surface-p-row-span": placement.phone.rowSpan,
    "--surface-p-order": placement.phone.order,
  } as CSSProperties;
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
function isStringList(value: SurfaceBinding | undefined): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
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
