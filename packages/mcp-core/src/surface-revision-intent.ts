import type { SurfaceNode, SurfaceSpec } from "@buildmates/surfaces";

export type SurfaceRevisionIntent =
  | { mode: "full_redesign"; summary: string }
  | { mode: "targeted"; summary: string; targetNodeIds: string[]; targetThemeKeys: string[]; targetDocumentFields?: Array<"html" | "css"> };

export function targetedSurfaceRevisionIsAllowed(
  base: SurfaceSpec,
  candidate: SurfaceSpec,
  intent: Extract<SurfaceRevisionIntent, { mode: "targeted" }>,
) {
  const targets = new Set(intent.targetNodeIds);
  const themeTargets = new Set(intent.targetThemeKeys);
  const documentTargets = new Set(intent.targetDocumentFields ?? []);
  if (targets.size === 0 && themeTargets.size === 0 && documentTargets.size === 0) return false;
  if (base.schemaVersion === "3" || candidate.schemaVersion === "3") {
    if (base.schemaVersion !== "3" || candidate.schemaVersion !== "3") return false;
    for (const key of Object.keys(base) as Array<keyof typeof base>) {
      if (key === "document") continue;
      if (JSON.stringify(base[key]) !== JSON.stringify(candidate[key])) return false;
    }
    return (["html", "css"] as const).every((key) => documentTargets.has(key) || base.document[key] === candidate.document[key]);
  }
  const baseComponent = base as unknown as Record<string, unknown> & { root: SurfaceNode; theme: Record<string, unknown> };
  const candidateComponent = candidate as unknown as Record<string, unknown> & { root: SurfaceNode; theme: Record<string, unknown> };
  for (const key of Object.keys(baseComponent)) {
    if (key === "root" || key === "theme") continue;
    if (JSON.stringify(baseComponent[key]) !== JSON.stringify(candidateComponent[key])) return false;
  }
  if (!sameUntargetedTheme(baseComponent.theme, candidateComponent.theme, themeTargets)) return false;
  return sameUntargetedTree(baseComponent.root, candidateComponent.root, targets);
}

function sameUntargetedTheme(base: Record<string, unknown>, candidate: Record<string, unknown>, targets: Set<string>) {
  if (Object.keys(base).sort().join("|") !== Object.keys(candidate).sort().join("|")) return false;
  return Object.keys(base).every((key) => targets.has(key) || JSON.stringify(base[key]) === JSON.stringify(candidate[key]));
}

function sameUntargetedTree(base: SurfaceNode, candidate: SurfaceNode, targets: Set<string>): boolean {
  if (base.id !== candidate.id) return false;
  if (targets.has(base.id)) return true;
  const baseChildren = "children" in base ? base.children : [];
  const candidateChildren = "children" in candidate ? candidate.children : [];
  const baseOwn = { ...base, ...(baseChildren.length ? { children: undefined } : {}) };
  const candidateOwn = { ...candidate, ...(candidateChildren.length ? { children: undefined } : {}) };
  if (JSON.stringify(baseOwn) !== JSON.stringify(candidateOwn) || baseChildren.length !== candidateChildren.length) return false;
  return baseChildren.every((child, index) => sameUntargetedTree(child, candidateChildren[index], targets));
}
