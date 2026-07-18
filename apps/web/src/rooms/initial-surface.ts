import { DESIGN_POLICY_VERSION, type SurfaceSpecV2 } from "@buildmates/surfaces";

export function initialRoomSurfaceSpec(): SurfaceSpecV2 {
  return {
    schemaVersion: "2",
    designPolicyVersion: DESIGN_POLICY_VERSION,
    kind: "room",
    title: "Buildmates introduction room",
    theme: {
      mode: "light",
      colors: { canvas: "#f4f0e7", surface: "#fffdf8", ink: "#22231f", mutedInk: "#55584f", accent: "#cbd6b5", accentInk: "#20251b", secondary: "#24251f", secondaryInk: "#ffffff", highlight: "#e7b94c", highlightInk: "#22231f", rule: "#c8c7bc", focusInner: "#000000", focusOuter: "#ffffff" },
      typography: { display: "engine-mono", body: "warm-grotesk", data: "engine-mono", scale: "comfortable", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
      shape: { corners: "soft", density: "comfortable", border: "hairline" },
      atmosphere: { motif: "thread", density: "quiet", tone: "accent", continuity: "section" },
      motion: { preset: "none", durationMs: 1_000, iterations: 1 },
    },
    root: {
      id: "room-root", type: "section", tone: "canvas", layout: "flow", padding: "lg", bleed: false, minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
      children: [{
        id: "room-flow", type: "stack", gap: "lg", align: "start", justify: "start", width: "prose",
        children: [
          { id: "room-title", type: "heading", level: 1, binding: "room.title", fallback: "Introduction room", size: "display", align: "start", width: "full", weight: "bold", lineHeight: "tight", tracking: "tight" },
          { id: "room-why", type: "callout", titleBinding: "room.whyTitle", bodyBinding: "room.whyBody", variant: "note", tone: "surface" },
          { id: "room-context", type: "fact-list", binding: "room.sharedFacts", emptyMessage: "The match used private relevance without exposing its underlying evidence.", layout: "grid", emphasis: "quiet" },
          { id: "room-privacy", type: "text", style: "caption", binding: "room.privacyNote", fallback: "Only mutually authorized context is shown here.", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" },
        ],
      }],
    },
    bindingManifest: { content: [{ key: "room.title", type: "text" }, { key: "room.whyTitle", type: "text" }, { key: "room.whyBody", type: "text" }, { key: "room.sharedFacts", type: "facts" }, { key: "room.privacyNote", type: "text" }], media: [] },
    approvedAssets: [], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
    accessibility: { label: "Private Buildmates introduction room", primaryHeadingNodeId: "room-title", reducedMotion: "required" },
  };
}
