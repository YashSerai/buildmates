import { DESIGN_POLICY_VERSION, renderGeneratedSite, safeParseSurfaceSpec, surfaceMediaIsAuthorized, type SurfaceBindings, type ProfileBriefMedia, type ProfileBriefAsset } from "@buildmates/surfaces";

export type PreviewAsset = { contentType: "image/png" | "image/jpeg" | "image/webp" | "image/avif" | "image/gif"; base64: string };

/** Produces a passive, network-free document from the same renderer as the public page. */
export function createChatSurfacePreview(specInput: unknown, surface: Record<string, unknown>, assets: Record<string, PreviewAsset>) {
  const parsed = safeParseSurfaceSpec(specInput, DESIGN_POLICY_VERSION);
  if (!parsed.success) throw new Error("surface_spec_invalid");
  const spec = parsed.data;
  if (spec.schemaVersion !== "3") throw new Error("surface_preview_upgrade_required");
  if (spec.kind !== surface.kind || !surfaceMediaIsAuthorized(spec, (surface.authorizedMedia ?? []) as ProfileBriefMedia[], (surface.approvedAssets ?? []) as ProfileBriefAsset[])) throw new Error("surface_spec_invalid");
  const content = surface.authorizedContent;
  if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("surface_brief_unavailable");
  let html = renderGeneratedSite({ html: spec.document.html, css: spec.document.css, bindings: content as SurfaceBindings, approvedAssetSources: spec.approvedAssets.map((asset) => asset.src) });
  for (const asset of spec.approvedAssets) {
    const bytes = assets[asset.src];
    if (!bytes || !/^image\/(?:png|jpeg|webp|avif|gif)$/.test(bytes.contentType) || !/^[a-zA-Z0-9+/]+={0,2}$/.test(bytes.base64)) throw new Error("surface_preview_media_unavailable");
    html = html.split(asset.src).join(`data:${bytes.contentType};base64,${bytes.base64}`);
  }
  // Asset bytes arrive through the authenticated tool, never browser cookies.
  html = html.replace(/img-src(?: 'self')?;/, "img-src data:;");
  return { html, kind: spec.kind, label: spec.accessibility.label, desktopMinHeight: spec.responsive.desktopMinHeight, phoneMinHeight: spec.responsive.phoneMinHeight };
}
