import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import { DESIGN_POLICY_ACTIVATED_AT, DESIGN_POLICY_ID, DESIGN_POLICY_SOURCE, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_VERSION, seedDesignPolicy } from "@buildmates/surfaces";
import { ensureRuntimeDesignPolicy, resetRuntimeDesignPolicyForTest } from "../../apps/web/src/platform/ensure-design-policy";

describe("D1 design policy seed", () => {
  let miniflare: Miniflare;
  let d1: D1Database;

  beforeEach(async () => {
    miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    d1 = (await miniflare.getD1Database("DB")) as D1Database;
    for (const migration of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await d1.prepare(statement).run();
    }
  }, 30_000);
  afterEach(async () => miniflare.dispose());

  it("stores the immutable active version and exact source hash idempotently", async () => {
    const repositories = createD1Repositories(d1 as unknown as RepositoryD1);
    await seedDesignPolicy(repositories);
    await seedDesignPolicy(repositories);
    await expect(d1.prepare("SELECT id,version,source_hash AS sourceHash,policy_json AS policyJson,activated_at AS activatedAt FROM design_policies").first()).resolves.toEqual({
      id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION, sourceHash: DESIGN_POLICY_SOURCE_HASH, policyJson: DESIGN_POLICY_SOURCE, activatedAt: new Date(DESIGN_POLICY_ACTIVATED_AT).getTime(),
    });
    await expect(repositories.surfaces.createPolicy({ id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION, sourceHash: "f".repeat(64), policyJson: "{}", activatedAt: new Date(DESIGN_POLICY_ACTIVATED_AT), at: new Date(DESIGN_POLICY_ACTIVATED_AT) })).rejects.toThrow("policy_conflict");
  }, 15_000);

  it("is invoked through the production runtime seed hook and remains idempotent", async () => {
    resetRuntimeDesignPolicyForTest();
    await ensureRuntimeDesignPolicy(d1);
    await ensureRuntimeDesignPolicy(d1);
    await expect(d1.prepare("SELECT version,source_hash AS sourceHash FROM design_policies WHERE id=?").bind(DESIGN_POLICY_ID).first()).resolves.toEqual({ version: DESIGN_POLICY_VERSION, sourceHash: DESIGN_POLICY_SOURCE_HASH });
  }, 15_000);
});
