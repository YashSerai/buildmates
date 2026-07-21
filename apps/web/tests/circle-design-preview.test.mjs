import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/circles/[id]/page.tsx", import.meta.url);
const stylesUrl = new URL("../app/circles/[id]/circle.module.css", import.meta.url);

test("Circle design links render the latest private preview only for the requested member view", async () => {
  const [page, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(page, /design === "preview"/);
  assert.match(page, /revision\.visibility='private_preview'/);
  assert.match(page, /revision\.status='preview'/);
  assert.match(page, /Private design preview/);
  assert.match(page, /Only active Circle members can see this version/);
  assert.match(styles, /\.previewNotice\s*\{/);
});
