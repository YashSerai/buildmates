import { DESIGN_POLICY_VERSION, type SurfaceBindings, type SurfaceSpec } from "@buildmates/surfaces";

export const workshopProfileSpec = {
  schemaVersion: "1",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "profile",
  title: "Aya's builder profile",
  theme: {
    mode: "light",
    colors: { canvas: "#f5f1e8", surface: "#fffdf7", ink: "#20211d", mutedInk: "#4f5149", accent: "#c8d4ad", accentInk: "#20251b", rule: "#c9c7ba", focusInner: "#000000", focusOuter: "#ffffff" },
    typography: { display: "editorial", body: "humanist", scale: "generous" },
    shape: { corners: "soft", density: "spacious" },
  },
  root: {
    id: "profile-root", type: "section", tone: "canvas", children: [
      { id: "profile-flow", type: "stack", gap: "xl", align: "start", children: [
        { id: "profile-intro", type: "stack", gap: "sm", align: "start", children: [
          { id: "profile-title", type: "heading", level: 1, binding: "profile.displayName", fallback: "Builder profile" },
          { id: "profile-summary", type: "text", style: "lead", binding: "profile.summary", fallback: "This builder has not added a summary yet." },
        ] },
        { id: "profile-punchcard", type: "decorative-region", regionId: "workbench-note", height: "medium" },
        { id: "profile-columns", type: "grid", columns: 2, gap: "lg", children: [
          { id: "profile-facts", type: "fact-list", binding: "profile.facts", emptyMessage: "No public work details yet." },
          { id: "profile-projects", type: "project-list", binding: "profile.projects", emptyMessage: "No public projects yet." },
        ] },
        { id: "profile-actions", type: "action-row", actions: [
          { id: "connect", action: "connect", supportingCopy: "Send a connection request based on shared work." },
          { id: "follow", action: "follow" },
          { id: "report", action: "report" },
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
  responsive: { collapseGridsBelow: "md", contentWidth: "wide", edgePadding: "comfortable" },
  accessibility: { label: "Aya's generated builder profile", primaryHeadingNodeId: "profile-title", reducedMotion: "required" },
} satisfies SurfaceSpec;

export const fieldNotesRoomSpec = {
  schemaVersion: "1",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "room",
  title: "Retrieval field notes",
  theme: {
    mode: "dark",
    colors: { canvas: "#171914", surface: "#242720", ink: "#f1eee4", mutedInk: "#b7b9ad", accent: "#4a3d25", accentInk: "#f1eee4", rule: "#4c5045", focusInner: "#000000", focusOuter: "#ffffff" },
    typography: { display: "technical", body: "humanist", scale: "comfortable" },
    shape: { corners: "square", density: "comfortable" },
  },
  root: {
    id: "room-root", type: "section", tone: "canvas", children: [
      { id: "room-layout", type: "grid", columns: 2, gap: "xl", children: [
        { id: "room-context", type: "stack", gap: "lg", align: "start", children: [
          { id: "room-title", type: "heading", level: 1, binding: "room.title", fallback: "Introduction room" },
          { id: "room-why", type: "callout", titleBinding: "room.whyTitle", bodyBinding: "room.whyBody" },
          { id: "room-actions", type: "action-row", actions: [
            { id: "room-open", action: "navigate" },
            { id: "room-privacy", action: "privacy" },
          ] },
        ] },
        { id: "room-notes", type: "stack", gap: "md", align: "start", children: [
          { id: "room-mark", type: "decorative-region", regionId: "retrieval-mark", height: "medium" },
          { id: "room-facts", type: "fact-list", binding: "room.sharedFacts", emptyMessage: "Shared context appears after both evaluations are complete." },
          { id: "room-caption", type: "text", style: "caption", binding: "room.privacyNote", fallback: "Only approved shared context appears here." },
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
  responsive: { collapseGridsBelow: "lg", contentWidth: "standard", edgePadding: "compact" },
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
