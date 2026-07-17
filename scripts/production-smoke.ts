import process from "node:process";

type Check = { name: string; ok: boolean; detail: string };

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const baseUrl = (valueAfter("--base-url") ?? process.env.BUILDMATES_BASE_URL ?? "").replace(/\/$/, "");
const mcpUrl = valueAfter("--mcp-url") ?? process.env.BUILDMATES_MCP_URL;

if (!baseUrl) {
  console.error("Pass --base-url or set BUILDMATES_BASE_URL.");
  process.exit(2);
}

const checks: Check[] = [];
async function check(name: string, run: () => Promise<string>) {
  try {
    checks.push({ name, ok: true, detail: await run() });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}
async function get(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
}

async function main() {
await check("public landing", async () => {
  const response = await get("/");
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  if (!body.toLowerCase().includes("buildmates")) throw new Error("Buildmates marker missing");
  return "200 with product marker";
});

await check("database readiness", async () => {
  const response = await get("/api/ready");
  const payload = await response.json().catch(() => null) as { status?: string } | null;
  if (response.status !== 200 || payload?.status !== "ok") throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get("x-request-id")) throw new Error("request ID header missing");
  return "D1 query succeeded";
});

await check("security headers", async () => {
  const response = await get("/");
  const csp = response.headers.get("content-security-policy") ?? "";
  if (!csp.includes("object-src 'none'") || !csp.includes("frame-ancestors 'none'")) throw new Error("CSP incomplete");
  if (response.headers.get("x-content-type-options") !== "nosniff") throw new Error("nosniff missing");
  return "CSP, framing, and MIME guards present";
});

await check("authenticated boundary", async () => {
  const response = await get("/home");
  if (![200, 302, 303, 307, 308, 401, 403].includes(response.status)) throw new Error(`unexpected HTTP ${response.status}`);
  return `HTTP ${response.status}; boundary reachable`;
});

await check("launch metadata", async () => {
  const [robots, manifest] = await Promise.all([get("/robots.txt"), get("/manifest.webmanifest")]);
  if (robots.status !== 200 || manifest.status !== 200) throw new Error(`robots ${robots.status}, manifest ${manifest.status}`);
  return "robots and manifest available";
});

if (mcpUrl) {
  await check("MCP initialize", async () => {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "buildmates-smoke", version: "1.0.0" } } }),
    });
    if (![200, 401].includes(response.status)) throw new Error(`HTTP ${response.status}`);
    return response.status === 200 ? "initialize succeeded" : "OAuth boundary enforced";
  });
}

for (const result of checks) console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}: ${result.detail}`);
const failures = checks.filter((result) => !result.ok);
if (failures.length) process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
