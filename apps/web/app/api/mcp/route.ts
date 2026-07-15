const explanation = {
  error: "mcp_sites_adapter_unavailable",
  detail: "This build does not claim Streamable HTTP and OAuth support in the Sites runtime. Deploy apps/mcp independently.",
  registry: "@buildmates/mcp-core",
};

export function GET() {
  return Response.json(explanation, { status: 501, headers: { "cache-control": "no-store" } });
}

export const POST = GET;
