import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appId = process.env.BUILDMATES_APP_ID?.trim();
if (!appId || !/^(?:asdk_app|connector)_[a-zA-Z0-9_-]{12,}$/.test(appId)) {
  throw new Error("BUILDMATES_APP_ID must be the real app ID returned by the ChatGPT app registration flow");
}
const manifest = JSON.parse(await readFile(resolve(root, ".codex-plugin/plugin.json"), "utf8"));
if (manifest.apps !== "./.app.json") throw new Error("plugin.json must use .app.json as its sole app registration");
await writeFile(resolve(root, ".app.json"), `${JSON.stringify({ apps: { buildmates: { id: appId, required: true } } }, null, 2)}\n`);
console.log("Bound the verified Buildmates app ID to plugin/.app.json");
