import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeScenario } from "./conversation-fixture";
import { writeJsonAtomic } from "./conversation-transport";

type InputRequest = { name: string; arguments: Record<string, unknown> };
type ToolResult = { content?: unknown; structuredContent?: unknown; isError?: boolean; [key: string]: unknown };

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const serverScript = fileURLToPath(new URL("./conversation-server.ts", import.meta.url));
const fixtureScript = fileURLToPath(new URL("./conversation-fixture.ts", import.meta.url));
const transportScript = fileURLToPath(new URL("./conversation-transport.ts", import.meta.url));
const toolScript = fileURLToPath(new URL("./conversation-tool.ts", import.meta.url));
const execFileAsync = promisify(execFile);

function usageError(message: string): never {
  throw new Error(`${message}\nUsage: node --import tsx scripts/qa/conversation-tool.ts --evidence <absolute-case-dir> --scenario <fixture-name> (--list | --input <absolute-json-file>)`);
}

function parseArgs(argv: string[]) {
  let evidence: string | undefined;
  let scenario = "existingnetwork";
  let list = false;
  let inputPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence") evidence = argv[++index];
    else if (arg === "--scenario") scenario = argv[++index] ?? usageError("--scenario needs a fixture name");
    else if (arg === "--list") list = true;
    else if (arg === "--input") inputPath = argv[++index] ?? usageError("--input needs an absolute JSON file");
    else usageError(`Unknown argument: ${arg}`);
  }
  if (!evidence || !isAbsolute(evidence)) usageError("--evidence must be an absolute case directory");
  if (list === Boolean(inputPath)) usageError("Choose exactly one of --list or --input");
  if (inputPath && !isAbsolute(inputPath)) usageError("--input must be an absolute JSON file");
  return { evidenceDir: evidence, scenario: normalizeScenario(scenario), list, inputPath };
}

async function readInput(path: string): Promise<InputRequest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read JSON input: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) usageError("Input must be an object containing name and arguments");
  const record = parsed as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) usageError("Input name must be a non-empty tool name");
  if (!record.arguments || typeof record.arguments !== "object" || Array.isArray(record.arguments)) usageError("Input arguments must be an object");
  return { name: record.name, arguments: record.arguments as Record<string, unknown> };
}

async function latestOutgoingSequence(evidenceDir: string): Promise<number | null> {
  try {
    const text = await readFile(join(evidenceDir, "tool-invocations.ndjson"), "utf8");
    for (const line of text.split("\n").reverse()) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as { sequence?: unknown; direction?: unknown };
        if (entry.direction === "outgoing" && typeof entry.sequence === "number" && Number.isSafeInteger(entry.sequence)) return entry.sequence;
      } catch {
        // Ignore a partial trailing line.
      }
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") throw error;
  }
  return null;
}

async function sourceProvenance() {
  const skillFiles = await readdir(resolve(repositoryRoot, "plugins/buildmates/skills"), { withFileTypes: true });
  const skills = skillFiles.filter((entry) => entry.isDirectory()).map((entry) => resolve(repositoryRoot, "plugins/buildmates/skills", entry.name, "SKILL.md")).sort();
  const productDiff = await execFileAsync("git", ["diff", "--", "apps", "packages", "plugin", "plugins"], { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const sourceRevision = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 1024 * 1024 });
  const hashes: Record<string, string> = {};
  for (const path of [serverScript, fixtureScript, ...skills]) hashes[path.slice(repositoryRoot.length + 1).replaceAll("\\", "/")] = createHash("sha256").update(await readFile(path)).digest("hex");
  const harnessHashes: Record<string, string> = {};
  for (const path of [transportScript, toolScript]) harnessHashes[path.slice(repositoryRoot.length + 1).replaceAll("\\", "/")] = createHash("sha256").update(await readFile(path)).digest("hex");
  return {
    sourceRevision: sourceRevision.stdout.trim(),
    workingProductDiffSha256: createHash("sha256").update(productDiff.stdout).digest("hex"),
    fixtureAndSkillSha256: hashes,
    harnessSha256: harnessHashes,
    syntheticLocalOnly: true,
  };
}

async function persistRawResult(evidenceDir: string, result: unknown, sequence: number | null, provenance: unknown, operation: string, toolName?: string) {
  const suffix = sequence === null ? `${Date.now()}-${process.pid}` : String(sequence);
  await writeJsonAtomic(join(evidenceDir, `tool-result-${suffix}.json`), result);
  await writeJsonAtomic(join(evidenceDir, `tool-result-${suffix}.meta.json`), { operation, toolName: toolName ?? null, sequence, provenance });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = options.inputPath ? await readInput(options.inputPath) : null;
  const provenance = await sourceProvenance();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", serverScript],
    cwd: repositoryRoot,
    env: { ...process.env, QA_EVIDENCE_DIR: resolve(options.evidenceDir), QA_SCENARIO: options.scenario, FORCE_COLOR: "0" } as Record<string, string>,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => process.stderr.write(`[fixture] ${String(chunk)}`));
  const client = new Client({ name: "buildmates-qa-tool-proxy", version: "1.0.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    if (options.list) {
      await persistRawResult(options.evidenceDir, listed, await latestOutgoingSequence(options.evidenceDir), provenance, "list_tools");
      process.stdout.write(`${JSON.stringify(listed)}\n`);
      return;
    }
    if (!input) usageError("A call input is required");
    if (!listed.tools.some((tool) => tool.name === input.name)) usageError(`Tool is not exposed by the canonical fixture: ${input.name}`);
    const result = await client.callTool({ name: input.name, arguments: input.arguments }) as ToolResult;
    await persistRawResult(options.evidenceDir, result, await latestOutgoingSequence(options.evidenceDir), provenance, "call_tool", input.name);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.close();
    await transport.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
