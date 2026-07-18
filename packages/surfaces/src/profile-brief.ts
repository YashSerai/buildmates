import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION } from "./design-policy";

export type ProfileBriefField = { key: string; label: string; value: unknown; bindingType: "text" | "facts" | "projects" | "strings" };
export type ProfileBriefMedia = { key: string; label: string; altKey: string; approvedAssetIds: string[] };
export type ProfileBriefAsset = { id: string; src: string };
type ProfileMediaSpec = {
  approvedAssets: Array<{ id: string; src: string }>;
  bindingManifest: { media: Array<{ key: string; altKey: string; approvedAssetIds: string[] }> };
};

export function profileMediaBinding(assetId: string) {
  if (!/^asset_[a-z0-9_-]{8,80}$/i.test(assetId)) throw new Error("surface_asset_id_invalid");
  const suffix = assetId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return { key: `profile.media.${suffix}`, altKey: `profile.media.${suffix}.alt` } as const;
}

export function profileSurfaceMediaIsAuthorized(
  spec: ProfileMediaSpec,
  authorizedMedia: readonly ProfileBriefMedia[],
  approvedAssets: readonly ProfileBriefAsset[],
): boolean {
  const allowedAssets = new Map(approvedAssets.map((asset) => [asset.id, asset.src]));
  const allowedBindings = new Map(authorizedMedia.map((binding) => [binding.key, binding]));
  const referenced = new Set<string>();
  for (const binding of spec.bindingManifest.media) {
    const allowed = allowedBindings.get(binding.key);
    if (!allowed || binding.altKey !== allowed.altKey || binding.approvedAssetIds.length < 1) return false;
    if (binding.approvedAssetIds.some((assetId) => !allowed.approvedAssetIds.includes(assetId) || !allowedAssets.has(assetId))) return false;
    binding.approvedAssetIds.forEach((assetId) => referenced.add(assetId));
  }
  if (spec.approvedAssets.length !== referenced.size) return false;
  return spec.approvedAssets.every((asset) => referenced.has(asset.id) && allowedAssets.get(asset.id) === asset.src);
}

export function createProfileGenerationBrief(input: { handle: string; fields: ProfileBriefField[]; media?: ProfileBriefMedia[]; approvedAssets?: ProfileBriefAsset[] }) {
  const seen = new Set<string>();
  const fields = input.fields.filter((field) => validBinding(field.key) && !seen.has(field.key) && (seen.add(field.key), true));
  const assets = new Map((input.approvedAssets ?? []).filter((asset) => /^asset_[a-z0-9_-]{8,80}$/i.test(asset.id) && /^\/api\/surface-assets\/[a-z0-9_-]+\/[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp)$/i.test(asset.src)).map((asset) => [asset.id, asset]));
  const mediaSeen = new Set<string>();
  const media = (input.media ?? []).flatMap((item) => {
    if (!validBinding(item.key) || !validBinding(item.altKey) || mediaSeen.has(item.key) || !seen.has(item.altKey)) return [];
    const approvedAssetIds = [...new Set(item.approvedAssetIds)].filter((id) => assets.has(id)).slice(0, 12);
    if (!approvedAssetIds.length) return [];
    mediaSeen.add(item.key);
    return [{ key: item.key, label: item.label, altKey: item.altKey, approvedAssetIds, authorization: "surface-approved" as const }];
  });
  return {
    kind: "profile" as const,
    schemaVersion: "2" as const,
    handle: input.handle,
    designPolicy: { id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION },
    instruction: "Compose a trusted, responsive full-page profile SurfaceSpec v2. Use only the bindings and identity-bound assets supplied here. Keep product actions trusted and keep private fields outside the spec.",
    allowedBindings: fields.map(({ key, label, bindingType }) => ({ key, label, type: bindingType })),
    authorizedContent: Object.fromEntries(fields.map(({ key, value }) => [key, value])),
    authorizedMedia: media,
    approvedAssets: media.length ? [...assets.values()].filter((asset) => media.some((item) => item.approvedAssetIds.includes(asset.id))) : [],
    capabilities: ["full-bleed sections", "nested containers", "12-column responsive canvas", "bounded overlap", "approved media backgrounds", "featured project compositions", "curated typography", "trusted action slots", "declarative reduced-motion-safe motion"],
    forbidden: ["scripts", "forms", "remote URLs", "arbitrary CSS", "external fonts", "permission controls", "private or unlisted fields"],
  };
}

function validBinding(value: string): boolean {
  return /^[a-z][a-z0-9_.-]{0,95}$/i.test(value);
}
