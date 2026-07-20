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
  assert.match(component, /const label = published\s*\? "Published"/);
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
