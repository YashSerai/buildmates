import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
  "../components/profile-projects/RevisionPreview.tsx",
  import.meta.url,
);
const stylesUrl = new URL(
  "../components/profile-projects/ProductForms.module.css",
  import.meta.url,
);
const qualityUrl = new URL(
  "../src/client/surface-quality.ts",
  import.meta.url,
);
const rendererUrl = new URL(
  "../components/surfaces/SurfaceRenderer.tsx",
  import.meta.url,
);
const rendererStylesUrl = new URL(
  "../components/surfaces/SurfaceRenderer.module.css",
  import.meta.url,
);

test("profile design workspace keeps the intro, actions, preview, and history on one axis", async () => {
  const [component, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(component, /className=\{styles\.designWorkspaceInner\}/);
  assert.match(component, /className=\{styles\.designWorkspaceHeader\}/);
  assert.match(component, /className=\{styles\.previewWorkspace\}/);
  assert.match(component, /className=\{styles\.historySection\}/);
  assert.match(styles, /\.designWorkspaceInner\s*\{[^}]*width:\s*min\(1180px,/s);
  assert.doesNotMatch(styles, /\.designWorkspace\s*>\s*header/);
});

test("profile design workspace distinguishes private previews from published versions", async () => {
  const component = await readFile(componentUrl, "utf8");

  assert.match(component, /Only you can see this version\./);
  assert.match(component, /Publishing replaces the page people see at your public profile link\./);
  assert.match(component, /revision\.status === "draft"/);
  assert.match(component, /revision\.baseRevisionNumber === data\.surface\.publishedRevisionNumber/);
  assert.match(component, /Published · Version \$\{revision\.revisionNumber\}/);
  assert.match(component, /Current private preview · Version \$\{revision\.revisionNumber\}/);
  assert.match(component, /You review every version\s+before it goes live\./);
  assert.match(component, /otherwise use Hallmark/);
  assert.match(component, /first direction/);
  assert.match(component, /complete rethink/);
  assert.doesNotMatch(component, /cannot expose private fields/);
  assert.doesNotMatch(component, /replace Buildmates privacy/);
});

test("profile design workspace keeps actions and history usable on phones", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.designWorkspaceHeader\s*\{\s*grid-template-columns:\s*1fr;/s);
  assert.match(styles, /\.currentDesignActions button\s*\{\s*width:\s*100%;/s);
  assert.match(styles, /\.designHistory > li\s*\{\s*padding-block:\s*\.85rem;/s);
});

test("published design actions share one baseline and control height", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.form \.currentDesignActions button,\s*\.currentDesignActions \.primaryAction\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*48px;[^}]*min-height:\s*48px;[^}]*margin:\s*0;[^}]*padding-block:\s*0;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s);
  assert.match(styles, /\.currentDesignActions span\s*\{[^}]*margin:\s*0;[^}]*line-height:\s*1\.45;/s);
});

test("profile design quality gate rejects an empty opening composition", async () => {
  const quality = await readFile(qualityUrl, "utf8");

  assert.match(quality, /opening_dead_space/);
  assert.match(quality, /hasEmptyOpeningComposition/);
  assert.match(quality, /emptyBeforeHeading \/ openingRect\.height > 0\.45/);
  assert.match(quality, /opening\.querySelector\("img,picture,figure"\)/);
});

test("generated profile frames measure their content instead of enforcing design dimensions", async () => {
  const [renderer, styles] = await Promise.all([
    readFile(rendererUrl, "utf8"),
    readFile(rendererStylesUrl, "utf8"),
  ]);

  assert.match(renderer, /document\.documentElement\.scrollHeight/);
  assert.match(renderer, /frame\.style\.height = `\$\{height\}px`/);
  assert.doesNotMatch(renderer, /--surface-generated-desktop-height/);
  assert.doesNotMatch(renderer, /--surface-generated-phone-height/);
  assert.match(styles, /\.renderer:global\(\.surface-generated-site\)\s*\{[^}]*height:\s*600px;[^}]*min-height:\s*0;/s);
  assert.doesNotMatch(styles, /var\(--surface-generated-(?:desktop|phone)-height\)/);
});
