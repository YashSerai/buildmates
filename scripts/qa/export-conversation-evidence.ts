import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultOutputDir = resolve(repositoryRoot, "docs/product/chat-native/qa/2026-10-02-conversations");

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 40;
const MAX_OBJECT_KEYS = 60;
const MAX_STRING_LENGTH = 2_000;

type JsonRecord = Record<string, unknown>;
type EvidenceEntry = {
  sequence?: unknown;
  recordedAt?: unknown;
  direction?: unknown;
  message?: unknown;
};

function usageError(message: string): never {
  throw new Error(`${message}\nUsage: node --import tsx scripts/qa/export-conversation-evidence.ts --input <absolute-recordings-dir> [--output <absolute-output-dir>]`);
}

function parseArgs(argv: string[]) {
  let input: string | undefined;
  let output = defaultOutputDir;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input") input = argv[++index] ?? usageError("--input needs a directory");
    else if (argument === "--output") output = argv[++index] ?? usageError("--output needs a directory");
    else usageError(`Unknown argument: ${argument}`);
  }
  if (!input || !isAbsolute(input)) usageError("--input must be an absolute recordings directory");
  if (!isAbsolute(output)) usageError("--output must be an absolute output directory");
  return { inputDir: resolve(input), outputDir: resolve(output) };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keep evidence useful without silently shortening a claim. Every bound is
 * represented in the output so a reviewer can tell that the source was larger.
 */
function bound(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return { __truncated: true, reason: "max_depth" };
  if (value === undefined) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return { __truncated: true, reason: "max_string_length", originalLength: value.length, preview: value.slice(0, MAX_STRING_LENGTH) };
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => bound(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) return { __truncated: true, reason: "max_array_items", originalLength: value.length, items, omittedCount: value.length - MAX_ARRAY_ITEMS };
    return items;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    const output: JsonRecord = {};
    for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) output[key] = bound(item, depth + 1);
    if (entries.length > MAX_OBJECT_KEYS) {
      output.__truncated = true;
      output.__truncationReason = "max_object_keys";
      output.__omittedKeyCount = entries.length - MAX_OBJECT_KEYS;
    }
    return output;
  }
  return String(value);
}

function pick(value: unknown, fields: string[]): JsonRecord {
  if (!isRecord(value)) return {};
  const result: JsonRecord = {};
  for (const field of fields) if (field in value) result[field] = value[field];
  return result;
}

function pickRows(value: unknown, fields: string[]) {
  if (!Array.isArray(value)) return value === undefined ? [] : bound(value);
  return bound(value.map((row) => pick(row, fields)));
}

function compactFinalState(snapshot: JsonRecord | null) {
  if (!snapshot) return { available: false, reason: "snapshot.json missing or unreadable" };
  return {
    available: true,
    syntheticOnly: snapshot.syntheticOnly === true,
    scenario: snapshot.scenario,
    fixedNow: snapshot.fixedNow,
    counts: bound(snapshot.counts),
    profiles: pickRows(snapshot.profiles, ["id", "userId", "displayName", "summary", "audience", "allowMatching", "acceptanceMode", "indexable", "coarseLocation", "locationMapOptIn", "timezone", "publishedAt", "updatedAt"]),
    profileFields: pickRows(snapshot.profileFields, ["profileId", "fieldKey", "audience", "allowMatching", "sourceStatus", "provenance", "updatedAt"]),
    projects: pickRows(snapshot.projects, ["id", "ownerUserId", "slug", "title", "summary", "audience", "allowMatching", "status", "stage", "indexable", "publishedAt", "updatedAt"]),
    projectCollaborators: pickRows(snapshot.projectCollaborators, ["projectId", "userId", "role", "approvedAt"]),
    proposals: pickRows(snapshot.proposals, ["id", "matchPairId", "state", "expiresAt", "terminalAt"]),
    circleProposals: pickRows(snapshot.circleProposals, ["id", "circleId", "proposerUserId", "kind", "status", "governanceVersion", "createdAt"]),
    connections: pickRows(snapshot.connections, ["id", "matchPairId", "state", "updatedAt"]),
    rooms: pickRows(snapshot.rooms, ["id", "connectionId", "status", "updatedAt"]),
    circles: pickRows(snapshot.circles, ["id", "name", "status", "governanceMode", "updatedAt"]),
    circleMembers: pickRows(snapshot.circleMembers, ["circleId", "userId", "role", "status", "joinedAt"]),
    messages: pickRows(snapshot.messages, ["id", "roomId", "senderUserId", "clientMessageId", "body", "bodyLength", "editedAt", "deletedAt", "createdAt"]),
    circleMessages: pickRows(snapshot.circleMessages, ["id", "circleId", "senderUserId", "clientMessageId", "body", "bodyLength", "editedAt", "deletedAt", "createdAt"]),
    setup: pickRows(snapshot.setup, ["userId", "completedStepsJson", "updatedAt"]),
    sources: pickRows(snapshot.sources, ["appId", "displayName", "category", "accessMode", "lastReviewedAt"]),
    automation: pickRows(snapshot.automation, ["userId", "kind", "cursor", "lastSuccessAt", "nextRunAt", "stateJson", "updatedAt"]),
    pulses: pickRows(snapshot.pulses, ["id", "userId", "intentSummary", "similarAdjacent", "localGlobal", "serendipity", "startsAt", "expiresAt", "controlsJson"]),
    surfaces: pickRows(snapshot.surfaces, ["id", "ownerUserId", "kind", "subjectId", "publishedRevisionId", "updatedAt"]),
    revisions: pickRows(snapshot.revisions, ["id", "surfaceId", "revisionNumber", "authorUserId", "status", "visibility", "specLength", "createdAt"]),
    idempotency: pickRows(snapshot.idempotency, ["id", "actorUserId", "operation", "status", "expiresAt", "updatedAt"]),
    exports: pickRows(snapshot.exports, ["id", "status", "objectKey", "expiresAt", "createdAt", "updatedAt"]),
    uncertainSaveProjectCommitted: snapshot.uncertainSaveProjectCommitted === true,
  };
}

function parseJsonText(text: unknown): unknown {
  if (typeof text !== "string") return bound(text);
  try {
    return bound(JSON.parse(text));
  } catch {
    return bound(text);
  }
}

function compactToolResult(message: JsonRecord | null) {
  if (!message) return { responseMissing: true };
  if ("error" in message) return { isError: true, error: bound(message.error) };
  const result = isRecord(message.result) ? message.result : {};
  const content = Array.isArray(result.content)
    ? result.content.map((block) => {
      if (!isRecord(block)) return bound(block);
      const compact: JsonRecord = { type: block.type };
      if ("text" in block) compact.data = parseJsonText(block.text);
      else if ("data" in block) compact.data = bound(block.data);
      return compact;
    })
    : [];
  return {
    isError: result.isError === true,
    content: bound(content),
    structuredContent: bound(result.structuredContent),
  };
}

function messageId(message: JsonRecord): string | null {
  const id = message.id;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return null;
}

async function readNdjson(path: string) {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOENT") return { entries: [] as EvidenceEntry[], parseErrors: 0, missing: true };
    throw error;
  }
  const entries: EvidenceEntry[] = [];
  let parseErrors = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (isRecord(value)) entries.push(value as EvidenceEntry);
      else parseErrors += 1;
    } catch {
      parseErrors += 1;
    }
  }
  return { entries, parseErrors, missing: false };
}

function compactToolCalls(entries: EvidenceEntry[]) {
  const pending = new Map<string, Array<{ request: JsonRecord; sequence: number | null; recordedAt: string | null }>>();
  const calls: JsonRecord[] = [];
  const ignoredMethods: Record<string, number> = {};
  for (const entry of entries) {
    const message = isRecord(entry.message) ? entry.message : null;
    if (!message) continue;
    const direction = entry.direction;
    const method = typeof message.method === "string" ? message.method : null;
    const sequence = typeof entry.sequence === "number" ? entry.sequence : null;
    const recordedAt = typeof entry.recordedAt === "string" ? entry.recordedAt : null;
    if (direction === "incoming" && method === "tools/call") {
      const params = isRecord(message.params) ? message.params : {};
      const id = messageId(message) ?? `missing-${sequence ?? calls.length}`;
      const queue = pending.get(id) ?? [];
      queue.push({ request: params, sequence, recordedAt });
      pending.set(id, queue);
      continue;
    }
    if (direction === "incoming" && method) {
      ignoredMethods[method] = (ignoredMethods[method] ?? 0) + 1;
      continue;
    }
    if (direction !== "outgoing") continue;
    const id = messageId(message);
    if (!id) continue;
    const queue = pending.get(id);
    const request = queue?.shift();
    if (!request) continue;
    const name = typeof request.request.name === "string" ? request.request.name : null;
    calls.push({
      requestSequence: request.sequence,
      responseSequence: sequence,
      requestRecordedAt: request.recordedAt,
      responseRecordedAt: recordedAt,
      tool: name,
      arguments: bound(request.request.arguments),
      result: compactToolResult(message),
    });
  }
  for (const queue of pending.values()) {
    for (const request of queue) {
      const name = typeof request.request.name === "string" ? request.request.name : null;
      calls.push({
        requestSequence: request.sequence,
        responseSequence: null,
        requestRecordedAt: request.recordedAt,
        responseRecordedAt: null,
        tool: name,
        arguments: bound(request.request.arguments),
        result: { responseMissing: true },
      });
    }
  }
  calls.sort((left, right) => Number(left.requestSequence ?? 0) - Number(right.requestSequence ?? 0));
  // Preserve every call, including late repair turns. Individual arguments and
  // results are already bounded; truncating this envelope would lose the final
  // authoritative reads that the quality judge relies on.
  return { calls, ignoredMethods, toolCallCount: calls.length, missingResponseCount: calls.filter((call) => isRecord(call.result) && call.result.responseMissing === true).length };
}

async function findCaseDirectories(inputDir: string): Promise<string[]> {
  const candidates: string[] = [];
  async function visit(directory: string, depth: number) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Unable to read ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "conversation.json")) candidates.push(directory);
    if (depth >= 2) return;
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "d1" && !entry.name.startsWith(".")) await visit(join(directory, entry.name), depth + 1);
    }
  }
  await visit(inputDir, 0);
  return candidates.sort((left, right) => left.localeCompare(right));
}

async function readOptionalJson(path: string): Promise<JsonRecord | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

async function findSidecarProvenance(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sidecars = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".meta.json")).map((entry) => entry.name).sort();
  for (const name of sidecars.reverse()) {
    const sidecar = await readOptionalJson(join(directory, name));
    if (sidecar?.provenance) return sidecar.provenance;
  }
  return null;
}

async function exportCase(directory: string, outputDir: string) {
  const record = await readOptionalJson(join(directory, "conversation.json"));
  if (!record) throw new Error(`Invalid or missing conversation.json in ${directory}`);
  const conversationCase = isRecord(record.case) ? record.case : {};
  const ndjson = await readNdjson(join(directory, "tool-invocations.ndjson"));
  const calls = compactToolCalls(ndjson.entries);
  const snapshot = await readOptionalJson(join(directory, "snapshot.json"));
  const provenance = record.provenance ?? await findSidecarProvenance(directory);
  const caseId = typeof conversationCase.id === "string" ? conversationCase.id : basename(directory);
  const output = {
    formatVersion: 1,
    syntheticOnly: true,
    recordedCase: {
      id: caseId,
      scenario: conversationCase.scenario ?? null,
      catalogTargets: bound(conversationCase.catalogTargets),
      assertions: bound(conversationCase.assertions),
      evidenceDirectory: basename(directory),
      sourceRecord: {
        model: record.model ?? null,
        reasoningEffort: record.reasoningEffort ?? null,
        engine: record.engine ?? null,
        sessionRecorded: Boolean(record.sessionId),
        turns: bound(record.turns),
      },
    },
    provenance: provenance ? bound(provenance) : { missing: true },
    evidence: {
      source: "real local stdio MCP transport with synthetic Miniflare D1; no production network or account credentials",
      ndjsonFile: "tool-invocations.ndjson",
      parseErrors: ndjson.parseErrors,
      ndjsonMissing: ndjson.missing,
      inventoryAndHandshakeEventsExcluded: true,
      ignoredIncomingMethods: calls.ignoredMethods,
      toolCallCount: calls.toolCallCount,
      missingResponseCount: calls.missingResponseCount,
      bounds: { maxDepth: MAX_DEPTH, maxArrayItems: MAX_ARRAY_ITEMS, maxObjectKeys: MAX_OBJECT_KEYS, maxStringLength: MAX_STRING_LENGTH, truncationMarkers: true },
      toolCalls: calls.calls,
    },
    finalState: compactFinalState(snapshot),
  };
  const safeName = basename(directory).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const outputPath = join(outputDir, `${safeName}.json`);
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return { input: relative(repositoryRoot, directory), output: relative(repositoryRoot, outputPath), caseId, toolCallCount: calls.toolCallCount };
}

async function main() {
  const { inputDir, outputDir } = parseArgs(process.argv.slice(2));
  await mkdir(outputDir, { recursive: true });
  const directories = await findCaseDirectories(inputDir);
  if (!directories.length) throw new Error(`No conversation.json recordings found under ${inputDir}`);
  const results = [];
  for (const directory of directories) results.push(await exportCase(directory, outputDir));
  process.stdout.write(`${JSON.stringify({ formatVersion: 1, outputDir, files: results }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
