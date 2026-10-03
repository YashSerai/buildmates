import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd());
const canonicalRoot = resolve(repositoryRoot, "plugin");
const betaRoot = resolve(repositoryRoot, "plugins", "buildmates");

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function skillFiles(root: string) {
  const entries = await readdir(resolve(root, "skills"), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/SKILL.md`)
    .sort();
}

describe("portable Buildmates plugin package", () => {
  it("uses a direct portable MCP connection and real package metadata", async () => {
    const manifest = await json(resolve(canonicalRoot, "plugin.json"));
    const mcp = await json(resolve(canonicalRoot, "mcp.json"));
    const extensions = manifest.extensions as Record<string, Record<string, unknown>> | undefined;
    const openAi = extensions?.["com.openai"];
    const presentation = openAi?.interface as Record<string, unknown> | undefined;

    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(manifest.name).toBe("buildmates");
    expect(openAi?.apps).toBeUndefined();
    expect(manifest.apps).toBeUndefined();
    expect(presentation.displayName).toBe("Buildmates");
    expect(presentation.supportURL).toMatch(/^https:\/\//);
    expect(presentation.logo).toBe("./assets/buildmates-mark.svg");
    expect(presentation.composerIcon).toBe("./assets/buildmates-mark.svg");
    await expect(stat(resolve(canonicalRoot, "assets", "buildmates-mark.svg"))).resolves.toBeDefined();
    expect(mcp).toMatchObject({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: { buildmates: { type: "streamable-http", url: expect.stringMatching(/^https:\/\/.+\/mcp$/) } },
    });
  });

  it("keeps the Codex compatibility files direct and app-free", async () => {
    const overlay = await json(resolve(canonicalRoot, ".codex-plugin", "plugin.json"));
    const legacy = await json(resolve(canonicalRoot, ".mcp.json"));
    const portable = await json(resolve(canonicalRoot, "mcp.json"));
    const betaOverlay = await json(resolve(betaRoot, ".codex-plugin", "plugin.json"));

    expect(overlay.apps).toBeUndefined();
    expect(overlay.mcpServers).toBe("./.mcp.json");
    expect(legacy).toEqual({ mcpServers: portable.mcpServers });
    expect(betaOverlay).toEqual(overlay);
  });

  it("keeps canonical and beta skills byte-for-byte synchronized", async () => {
    const canonicalFiles = await skillFiles(canonicalRoot);
    const betaFiles = await skillFiles(betaRoot);
    expect(betaFiles).toEqual(canonicalFiles);
    for (const file of canonicalFiles) {
      await expect(readFile(resolve(betaRoot, "skills", file), "utf8")).resolves.toBe(await readFile(resolve(canonicalRoot, "skills", file), "utf8"));
    }
    await expect(readFile(resolve(betaRoot, "plugin.json"), "utf8")).resolves.toBe(await readFile(resolve(canonicalRoot, "plugin.json"), "utf8"));
    await expect(readFile(resolve(betaRoot, "mcp.json"), "utf8")).resolves.toBe(await readFile(resolve(canonicalRoot, "mcp.json"), "utf8"));
  });
});
