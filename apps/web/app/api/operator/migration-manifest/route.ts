import { getPlatformBindings } from "@/src/platform/bindings";
import { sha256 } from "@/src/auth/github-oauth";

export async function GET(request: Request) {
  const configured = process.env.MIGRATION_AUDIT_SECRET;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !presented || !(await equalSecret(configured, presented))) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const { DB, ASSETS } = await getPlatformBindings();
  const auditErrors: string[] = [];
  const tables = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .all<{ name: string }>();
  const counts: Record<string, number> = {};
  for (const { name } of tables.results) {
    if (!/^[a-z0-9_]+$/i.test(name)) continue;
    try {
      const row = await DB.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).first<{ count: number }>();
      counts[name] = Number(row?.count ?? 0);
    } catch {
      auditErrors.push(`d1:${name}`);
    }
  }
  const objectFingerprints: string[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await ASSETS.list({ cursor, limit: 1000 });
      for (const object of page.objects) objectFingerprints.push(await sha256(object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch {
    auditErrors.push("r2:list");
  }
  return Response.json({ generatedAt: new Date().toISOString(), tableCounts: counts, r2ObjectCount: objectFingerprints.length, r2ObjectKeyHashes: objectFingerprints.sort(), auditErrors }, { headers: { "cache-control": "no-store", "content-type": "application/json" } });
}

async function equalSecret(expected: string, presented: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(expected), sha256(presented)]);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}
