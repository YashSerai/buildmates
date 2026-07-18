import { DESIGN_POLICY_VERSION, type SurfaceBindings, type SurfaceSpec } from "@buildmates/surfaces";

export const workshopProfileSpec = {
  schemaVersion: "2",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "profile",
  title: "Aya's builder profile",
  theme: {
    mode: "light",
    colors: { canvas: "#f5f1e8", surface: "#fffdf7", ink: "#20211d", mutedInk: "#4f5149", accent: "#c8d4ad", accentInk: "#20251b", secondary: "#29352b", secondaryInk: "#ffffff", highlight: "#f3c76d", highlightInk: "#221900", rule: "#8b8d82", focusInner: "#000000", focusOuter: "#ffffff" },
    typography: { display: "sturdy-slab", body: "warm-grotesk", data: "engine-mono", scale: "generous", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
    shape: { corners: "soft", density: "spacious", border: "hairline" },
    atmosphere: { motif: "registration", density: "present", tone: "accent", continuity: "page" },
    motion: { preset: "drift", durationMs: 7000, iterations: 1 },
  },
  root: {
    id: "profile-root", type: "section", tone: "canvas", layout: "hero", padding: "xl", bleed: true, minHeight: "viewport", background: "paper-rule", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center", children: [
      { id: "profile-shell", type: "container", width: "wide", align: "center", padding: "none", children: [
      { id: "profile-flow", type: "stack", gap: "xl", align: "start", justify: "start", width: "full", children: [
        { id: "profile-intro", type: "stack", gap: "sm", align: "start", justify: "start", width: "wide", children: [
          { id: "profile-title", type: "heading", level: 1, binding: "profile.displayName", fallback: "Builder profile", size: "hero", align: "start", width: "balanced", weight: "black", lineHeight: "tight", tracking: "tight" },
          { id: "profile-summary", type: "text", style: "lead", binding: "profile.summary", fallback: "This builder has not added a summary yet.", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" },
        ] },
        { id: "profile-punchcard", type: "decorative-region", regionId: "workbench-note", height: "tall" },
        { id: "profile-columns", type: "grid", columns: 2, layout: "feature-right", gap: "lg", align: "start", children: [
          { id: "profile-facts", type: "fact-list", binding: "profile.facts", emptyMessage: "No public work details yet.", layout: "rail", emphasis: "strong" },
          { id: "profile-projects", type: "project-list", binding: "profile.projects", emptyMessage: "No public projects yet.", layout: "editorial", columns: 1 },
        ] },
        { id: "profile-actions", type: "action-slot", placement: "footer", actions: [
          { id: "connect", action: "connect", supportingCopy: "Send a connection request based on shared work." },
          { id: "follow", action: "follow" },
          { id: "report", action: "report" },
        ] },
      ] },
      ] },
    ],
  },
  bindingManifest: { content: [
    { key: "profile.displayName", type: "text" }, { key: "profile.summary", type: "text" },
    { key: "profile.facts", type: "facts" }, { key: "profile.projects", type: "projects" },
  ], media: [] },
  approvedAssets: [],
  decorativeRegions: [{ id: "workbench-note", label: "Current work note", html: '<section class="bench-note"><p class="bench-label">On the workbench</p><h2>Retrieval evaluation that can survive messy, local data.</h2><p>Testing failure cases before adding another retrieval trick.</p></section>', css: ".bench-note{padding:1.4rem;background:#30352c;color:#f7f3e9;border-radius:.2rem}.bench-label{margin:0 0:.65rem;color:#c8d4ad;font-size:.8rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}.bench-note h2{margin:0;max-width:26ch;font-family:Georgia,serif;font-size:clamp(1.4rem,4vw,2.3rem);line-height:1.12}.bench-note p{max-width:58ch;line-height:1.55}" }],
  responsive: { collapseGridsBelow: "md", contentWidth: "wide", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
  accessibility: { label: "Aya's generated builder profile", primaryHeadingNodeId: "profile-title", reducedMotion: "required" },
} satisfies SurfaceSpec;

export const fieldNotesRoomSpec = {
  schemaVersion: "2",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "room",
  title: "Retrieval field notes",
  theme: {
    mode: "dark",
    colors: { canvas: "#171914", surface: "#242720", ink: "#f1eee4", mutedInk: "#b7b9ad", accent: "#4a3d25", accentInk: "#ffffff", secondary: "#26382f", secondaryInk: "#ffffff", highlight: "#5a301f", highlightInk: "#ffffff", rule: "#6d7165", focusInner: "#000000", focusOuter: "#ffffff" },
    typography: { display: "engine-mono", body: "warm-grotesk", data: "engine-mono", scale: "comfortable", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
    shape: { corners: "square", density: "comfortable", border: "strong" },
    atmosphere: { motif: "thread", density: "quiet", tone: "highlight", continuity: "page" },
    motion: { preset: "pulse", durationMs: 5000, iterations: 1 },
  },
  root: {
    id: "room-root", type: "section", tone: "canvas", layout: "cover", padding: "xl", bleed: true, minHeight: "viewport", background: "registration", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center", children: [
      { id: "room-shell", type: "container", width: "wide", align: "center", padding: "none", children: [
      { id: "room-layout", type: "grid", columns: 2, layout: "feature-left", gap: "xl", align: "start", children: [
        { id: "room-context", type: "stack", gap: "lg", align: "start", justify: "start", width: "full", children: [
          { id: "room-title", type: "heading", level: 1, binding: "room.title", fallback: "Introduction room", size: "display", align: "start", width: "balanced", weight: "bold", lineHeight: "tight", tracking: "tight" },
          { id: "room-why", type: "callout", titleBinding: "room.whyTitle", bodyBinding: "room.whyBody", variant: "note", tone: "secondary" },
          { id: "room-actions", type: "action-row", actions: [
            { id: "room-open", action: "navigate" },
            { id: "room-privacy", action: "privacy" },
          ] },
        ] },
        { id: "room-notes", type: "stack", gap: "md", align: "start", justify: "start", width: "full", children: [
          { id: "room-mark", type: "decorative-region", regionId: "retrieval-mark", height: "medium" },
          { id: "room-facts", type: "fact-list", binding: "room.sharedFacts", emptyMessage: "Shared context appears after both evaluations are complete.", layout: "grid", emphasis: "strong" },
          { id: "room-caption", type: "text", style: "caption", binding: "room.privacyNote", fallback: "Only approved shared context appears here.", align: "start", width: "prose", weight: "regular", lineHeight: "normal", tracking: "wide" },
        ] },
      ] },
      ] },
    ],
  },
  bindingManifest: { content: [
    { key: "room.title", type: "text" }, { key: "room.whyTitle", type: "text" }, { key: "room.whyBody", type: "text" },
    { key: "room.sharedFacts", type: "facts" }, { key: "room.privacyNote", type: "text" },
  ], media: [] },
  approvedAssets: [],
  decorativeRegions: [{ id: "retrieval-mark", label: "Retrieval room marker", html: '<figure class="field-mark"><div class="cards" aria-hidden="true"><span>source</span><span>claim</span><span>check</span></div><figcaption>Shared field notes · revision 1</figcaption></figure>', css: ".field-mark{margin:0;padding:1.25rem;border:1px solid #4c5045;background:#20231d}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.cards span{padding:1rem .5rem;background:#d4bd87;color:#211d14;text-align:center;font-weight:700}.field-mark figcaption{margin-top:.8rem;color:#b7b9ad;font-size:.82rem}" }],
  responsive: { collapseGridsBelow: "lg", contentWidth: "wide", edgePadding: "compact", heroStackBelow: "lg", preserveContentOrder: true },
  accessibility: { label: "Retrieval introduction room", primaryHeadingNodeId: "room-title", reducedMotion: "required" },
} satisfies SurfaceSpec;

export const workshopBindings: SurfaceBindings = {
  "profile.displayName": "Aya Chen",
  "profile.summary": "Building local-first evaluation tools for teams that need to understand why retrieval fails, not just whether a score moved.",
  "profile.facts": [
    { label: "Working from", value: "Vancouver · open to nearby and global builders" },
    { label: "Current stage", value: "Prototype with working evaluation runs" },
    { label: "Interested in", value: "Retrieval, local data, developer tools" },
  ],
  "profile.projects": [
    { id: "project-retrieval-bench", title: "Retrieval Bench", summary: "A local test bench for tracing weak citations and brittle chunking choices.", href: "/projects/retrieval-bench" },
    { id: "project-field-notes", title: "Field Notes", summary: "Tiny public write-ups from real retrieval failures, with the private data removed.", href: "/projects/field-notes" },
  ],
};

export const longWorkshopBindings: SurfaceBindings = {
  ...workshopBindings,
  "profile.displayName": "Aya Chen, building retrieval tools for teams with imperfect data",
  "profile.summary": "Building local-first evaluation tools for small teams working across long, contradictory document sets. The current focus is evidence traceability, query-specific failure analysis, and making every result useful without turning the product into another wall of retrieval metrics.",
  "profile.projects": Array.from({ length: 5 }, (_, index) => ({ id: `project-${index}`, title: `Retrieval experiment ${index + 1}: ${"edge cases ".repeat(index + 1).trim()}`, summary: "A deliberately long project summary used to prove that generated surfaces wrap, align, and remain readable without clipping at narrow widths.", href: `/projects/retrieval-experiment-${index + 1}` })),
};

export const roomBindings: SurfaceBindings = {
  "room.title": "Retrieval field notes",
  "room.whyTitle": "Why you were introduced",
  "room.whyBody": "Both of you are testing retrieval quality against real project data. Aya is tracing citation failures; Milo is comparing compact rerankers under latency limits.",
  "room.sharedFacts": [
    { label: "Shared topic", value: "Retrieval evaluation" },
    { label: "Different angle", value: "Evidence tracing × latency" },
    { label: "Room access", value: "Aya and Milo only" },
  ],
  "room.privacyNote": "This page contains only context each person approved for this introduction.",
};
