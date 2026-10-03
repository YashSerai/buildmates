import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { signInTestUser } from "./helpers/auth";
import { qaEvidencePath } from "./helpers/evidence-path";

const evidencePath = qaEvidencePath("2026-07-19", "local-codex-candidate-shortlist.json");

test("export the guarded local shortlist for visible Codex QA", async ({ page }) => {
  await signInTestUser(page, "local-codex-match-evidence");

  const reset = await page.evaluate(async () => {
    const response = await fetch("/api/testing/qa-scenarios", {
      method: "DELETE",
      headers: { "x-buildmates-e2e": "1" },
    });
    return { ok: response.ok, status: response.status };
  });
  expect(reset).toEqual({ ok: true, status: 204 });

  const seeded = await page.evaluate(async () => {
    const response = await fetch("/api/testing/qa-scenarios", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-buildmates-e2e": "1",
      },
      body: JSON.stringify({ scenario: "candidate_spectrum" }),
    });
    return { ok: response.ok, status: response.status, value: await response.json() };
  });
  expect(seeded.ok).toBe(true);
  expect(seeded.status).toBe(201);

  const shortlist = await page.evaluate(async () => {
    const response = await fetch("/api/matches/candidates?limit=30");
    return { ok: response.ok, status: response.status, value: await response.json() };
  });
  expect(shortlist.ok).toBe(true);
  expect(shortlist.status).toBe(200);

  const value = shortlist.value as {
    batchId: string;
    candidates: Array<{
      userId: string;
      displayName: string;
      summary: string;
      indexVersion: number;
      taxonomyVersion: number;
      visibleReasons: string[];
      visibleEvidenceIds: string[];
    }>;
  };
  expect(value.candidates.map((candidate) => candidate.displayName)).toEqual([
    "Mira Chen",
    "Mira Labs",
    "Amara Okafor",
    "Theo Martin",
  ]);
  expect(JSON.stringify(value)).not.toContain("Hidden Candidate");
  expect(JSON.stringify(value)).not.toContain("QA_PRIVATE_SENTINEL_NEVER_RENDER");

  const manifest = {
    source: "guarded_local_buildmates_candidate_shortlist",
    generatedAt: new Date().toISOString(),
    requestedLimit: 30,
    returnedCount: value.candidates.length,
    batchId: value.batchId,
    candidates: value.candidates,
    privacyAssertions: {
      excludedCandidateAbsent: true,
      privateSentinelAbsent: true,
      rawWorkSignalsAbsent: true,
    },
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const cleanup = await page.evaluate(async () => {
    const response = await fetch("/api/testing/qa-scenarios", {
      method: "DELETE",
      headers: { "x-buildmates-e2e": "1" },
    });
    return { ok: response.ok, status: response.status };
  });
  expect(cleanup).toEqual({ ok: true, status: 204 });
});
