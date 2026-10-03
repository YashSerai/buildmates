import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { consumeAccountExportRateLimit, getAccountExport } from "@/src/privacy/account-export";
import { accountExportSectionSchema } from "@buildmates/mcp-core";

/**
 * Browser downloads remain a compatibility surface. The same bounded export
 * service is also used by the authenticated chat/MCP action, so the browser
 * route cannot become a second data authority.
 */
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  try {
    const url = new URL(request.url);
    const limitValue = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, Math.trunc(limitValue))) : 100;
    const sectionValue = url.searchParams.get("section");
    const sectionResult = sectionValue ? accountExportSectionSchema.safeParse(sectionValue) : null;
    if (sectionResult && !sectionResult.success) return Response.json({ error: "invalid_export_section" }, { status: 400 });
    const section = sectionResult?.success ? sectionResult.data : undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const now = Date.now();
    await consumeAccountExportRateLimit(DB, user.id, { section, cursor }, now);
    const payload = await getAccountExport(DB, user.id, { section, cursor, limit, now });
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="buildmates-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("privacy_export_failed", error instanceof Error ? error.message : "unknown_error");
    const code = error instanceof Error ? error.message : "export_failed";
    if (code === "invalid_export_cursor") return Response.json({ error: code }, { status: 400 });
    const rateLimited = code === "account_export_rate_limited" || code === "account_export_page_rate_limited";
    return Response.json({ error: rateLimited ? code : "export_failed" }, { status: rateLimited ? 429 : 500 });
  }
}
