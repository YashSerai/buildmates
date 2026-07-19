#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const manifestPath = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("candidate_manifest_path_required");

const server = new McpServer({ name: "buildmates-local-qa", version: "1.0.0" });

server.registerTool(
  "get_candidate_shortlist",
  {
    title: "Get Buildmates candidate shortlist",
    description:
      "Returns the bounded, viewer-authorized Buildmates shortlist from the guarded local QA account. Use this when the user naturally asks whether they have relevant builders. Present names, approved summaries, and user-facing relevance reasons only; never expose batch IDs, candidate IDs, raw Work Signals, excluded candidates, or private fields.",
    inputSchema: {
      limit: z.number().int().min(1).max(30).default(30),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ limit }) => {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const reasonLabels = {
      topicOverlap: "Related current work",
      topicAdjacency: "Adjacent interests",
      toolDomainFit: "Related tools or domain",
      intentFit: "Compatible networking intent",
      serendipity: "A useful adjacent perspective",
    };
    const candidates = manifest.candidates.slice(0, limit).map((candidate) => ({
      displayName: candidate.displayName,
      summary: candidate.summary,
      relevanceReasons: candidate.visibleReasons.map(
        (reason) => reasonLabels[reason] ?? "Mutual relevance",
      ),
    }));
    const result = {
      candidates,
      returnedCount: candidates.length,
      privacyBoundary: "Approved display context only. Raw Work Signals and excluded or private fields are absent.",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);

await server.connect(new StdioServerTransport());
