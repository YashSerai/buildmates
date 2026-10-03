import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";

const SECRET_KEYS = new Set(["authorization", "access_token", "refresh_token", "token", "code", "secret", "password"]);

function bounded(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[depth-limited]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "string" && value.length > 12_000 ? `${value.slice(0, 12_000)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => bounded(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 60)) result[key] = SECRET_KEYS.has(key.toLowerCase()) ? "[redacted]" : bounded(item, depth + 1);
    return result;
  }
  return String(value);
}

export type SnapshotWriter = (lastMessage?: unknown) => Promise<void>;

/**
 * Adds bounded request/response evidence around the real stdio transport.
 * The wrapped transport leaves stdout owned by MCP; evidence goes to files and stderr.
 */
export class EvidenceStdioTransport implements Transport {
  private readonly stdio = new StdioServerTransport();
  private readonly logPath: string;
  private readonly snapshot: SnapshotWriter;
  private readonly messageExtra?: MessageExtraInfo;
  private queue: Promise<void> = Promise.resolve();
  private sequence = 0;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;

  constructor(evidenceDir: string, snapshot: SnapshotWriter, messageExtra?: MessageExtraInfo) {
    this.logPath = join(evidenceDir, "tool-invocations.ndjson");
    this.snapshot = snapshot;
    this.messageExtra = messageExtra;
    this.stdio.onmessage = (message) => {
      this.enqueue({ direction: "incoming", message });
      this.onmessage?.(message, this.messageExtra);
    };
    this.stdio.onclose = () => this.onclose?.();
    this.stdio.onerror = (error) => this.onerror?.(error);
  }

  async start() {
    await this.initializeSequence();
    await this.stdio.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions) {
    void options;
    await this.enqueue({ direction: "outgoing", message });
    await this.stdio.send(message);
  }

  async close() {
    await this.queue;
    await this.stdio.close();
  }

  private enqueue(entry: { direction: "incoming" | "outgoing"; message: JSONRPCMessage }): Promise<void> {
    const sequence = ++this.sequence;
    this.queue = this.queue.then(async () => {
      const line = {
        sequence,
        recordedAt: new Date().toISOString(),
        direction: entry.direction,
        message: bounded(entry.message),
      };
      await mkdir(dirname(this.logPath), { recursive: true });
      await appendFile(this.logPath, `${JSON.stringify(line)}\n`, "utf8");
      if (entry.direction === "outgoing") await this.snapshot(line);
    }).catch((error) => {
      process.stderr.write(`[buildmates-qa] evidence write failed: ${error instanceof Error ? error.message : String(error)}\n`);
    });
    return this.queue;
  }

  private async initializeSequence() {
    try {
      const existing = await readFile(this.logPath, "utf8");
      for (const line of existing.split("\n").reverse()) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { sequence?: unknown };
          if (typeof parsed.sequence === "number" && Number.isSafeInteger(parsed.sequence) && parsed.sequence >= 0) {
            this.sequence = parsed.sequence;
            return;
          }
        } catch {
          // Ignore a partial trailing line and continue to the last complete entry.
        }
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code !== "ENOENT") throw error;
    }
  }
}

export async function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.tmp-${process.pid}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

export { bounded };
