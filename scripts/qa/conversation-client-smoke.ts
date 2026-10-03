import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cwd = resolve(process.cwd());
const evidenceDir = resolve(process.env.QA_EVIDENCE_DIR ?? ".qa-evidence/buildmates-conversation-smoke");
const scenario = process.env.QA_SCENARIO ?? "network";

function toolText(result: unknown): unknown {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = content.find((item) => item.type === "text")?.text;
  try { return text ? JSON.parse(text) : result; } catch { return text ?? result; }
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "scripts/qa/conversation-server.ts"],
    cwd,
    env: { ...process.env, QA_EVIDENCE_DIR: evidenceDir, QA_SCENARIO: scenario, FORCE_COLOR: "0" } as Record<string, string>,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => process.stderr.write(`[fixture] ${String(chunk)}`));
  const client = new Client({ name: "buildmates-qa-smoke", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  const required = ["get_setup_state", "get_buildmates_workspace", "perform_buildmates_action", "perform_buildmates_project_action", "perform_buildmates_relationship_action", "perform_buildmates_circle_action"];
  for (const name of required) if (!names.includes(name)) throw new Error(`Missing canonical tool ${name}`);
  const setup = toolText(await client.callTool({ name: "get_setup_state", arguments: { workspaceScope: "global" } }));
  const home = toolText(await client.callTool({ name: "get_buildmates_workspace", arguments: { view: "home", workspaceScope: "global" } }));
  const projects = toolText(await client.callTool({ name: "get_buildmates_workspace", arguments: { view: "projects", workspaceScope: "global" } }));
  const connections = toolText(await client.callTool({ name: "get_buildmates_workspace", arguments: { view: "connections", workspaceScope: "global" } }));
  const room = toolText(await client.callTool({ name: "get_buildmates_workspace", arguments: { view: "room", subjectId: "qa_room_alice_bob", workspaceScope: "global" } }));
  const circle = toolText(await client.callTool({ name: "get_buildmates_workspace", arguments: { view: "circle", subjectId: "qa_circle_builders", workspaceScope: "global" } }));
  const saveProject = toolText(await client.callTool({ name: "perform_buildmates_project_action", arguments: {
    workspaceScope: "global", idempotencyKey: "qa-smoke-project-save-v1",
    action: { kind: "save_project", project: { slug: "smoke-project", title: "Smoke Project", summary: "A private synthetic project used for a real MCP client smoke check.", audience: "private", allowMatching: false, stage: "exploring", status: "draft", links: [], taxonomy: [] }, },
  } }));
  const sendMessage = toolText(await client.callTool({ name: "perform_buildmates_relationship_action", arguments: {
    workspaceScope: "global", idempotencyKey: "qa-smoke-message-v1",
    action: { kind: "send_room_message", roomId: "qa_room_alice_bob", clientMessageId: "qa-smoke-client-message", body: "A real local MCP client reached the synthetic room.", confirmation: "confirmed" },
  } }));
  const sendMessageReplay = toolText(await client.callTool({ name: "perform_buildmates_relationship_action", arguments: {
    workspaceScope: "global", idempotencyKey: "qa-smoke-message-v1",
    action: { kind: "send_room_message", roomId: "qa_room_alice_bob", clientMessageId: "qa-smoke-client-message", body: "A real local MCP client reached the synthetic room.", confirmation: "confirmed" },
  } }));
  const snapshot = JSON.parse(await readFile(resolve(evidenceDir, "snapshot.json"), "utf8")) as { counts?: unknown; lastMessage?: unknown; syntheticOnly?: boolean };
  await client.close();
  process.stdout.write(`${JSON.stringify({ tools: names.length, setup, home, projects, connections, room, circle, saveProject, sendMessage, sendMessageReplay, snapshot: { counts: snapshot.counts, syntheticOnly: snapshot.syntheticOnly, lastMessage: snapshot.lastMessage } }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
