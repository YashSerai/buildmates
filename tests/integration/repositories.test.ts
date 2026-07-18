import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  asUserId,
  type BuildmatesRepositories,
  type CircleId,
  type CohortId,
  type ConnectionId,
  type ProfileId,
  type ProjectId,
  type RoomId,
} from "../../packages/domain/src";
import {
  buildWeekFixture,
  createD1Repositories,
  createMemoryRepositories,
  seedRepositoryFixtures,
  type RepositoryD1,
} from "../../packages/database/src";
import {
  completeIdentityLink,
  createD1IdentityLinkStore,
  sha256,
} from "../../apps/web/src/platform/identity-link-store";
import { DESIGN_POLICY_ID, DESIGN_POLICY_SOURCE, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_VERSION, PROFILE_V2_FIXTURES, SURFACE_POLICY_REGISTRY, type SurfaceSpec } from "@buildmates/surfaces";

const at = new Date("2026-07-15T00:00:00Z");
const later = new Date("2099-07-16T00:00:00Z");
const alice = {
  id: asUserId("user_alice"),
  status: "active" as const,
  operatorRole: "none" as const,
  createdAt: at,
};
const bob = {
  id: asUserId("user_bob"),
  status: "active" as const,
  operatorRole: "none" as const,
  createdAt: at,
};
const charlie = {
  id: asUserId("user_charlie"),
  status: "active" as const,
  operatorRole: "none" as const,
  createdAt: at,
};
const operator = {
  id: asUserId("user_operator"),
  status: "active" as const,
  operatorRole: "moderator" as const,
  createdAt: at,
};

function surfaceSpecJson(kind: "profile" | "room" | "circle", overrides: Record<string, unknown> = {}): string {
  const requestedPolicyVersion = String(overrides.designPolicyVersion ?? DESIGN_POLICY_VERSION);
  if (requestedPolicyVersion === DESIGN_POLICY_VERSION) {
    const current = structuredClone(PROFILE_V2_FIXTURES[1]);
    return JSON.stringify({
      ...current,
      kind,
      title: `${kind} surface`,
      approvedAssets: [],
      bindingManifest: { ...current.bindingManifest, media: [] },
      accessibility: {
        ...current.accessibility,
        label: `${kind} surface`,
      },
      ...overrides,
    });
  }
  const spec: SurfaceSpec = {
    schemaVersion: "1", designPolicyVersion: requestedPolicyVersion, kind, title: `${kind} surface`,
    theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
    root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "surface.title", fallback: "Surface" }] },
    bindingManifest: { content: [{ key: "surface.title", type: "text" }], media: [] }, approvedAssets: [], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: `${kind} surface`, primaryHeadingNodeId: "title", reducedMotion: "required" },
  };
  return JSON.stringify({ ...spec, ...overrides });
}

describe("repository aggregate and authorization parity", () => {
  let mf: Miniflare;
  let d1: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    d1 = (await mf.getD1Database("DB")) as D1Database;
    await applyMigrations(d1);
  });
  afterEach(async () => {
    await mf.dispose();
  });

  for (const adapter of ["memory", "d1"] as const) {
    it(`${adapter} implements every Task 3 aggregate boundary with derived authorization`, async () => {
      const repositories =
        adapter === "memory"
          ? createMemoryRepositories()
          : createD1Repositories(d1 as unknown as RepositoryD1);
      await exerciseAllAggregates(repositories);
      if (adapter === "d1") {
        await expect(
          d1
            .prepare(
              "SELECT published_revision_id AS publishedRevisionId FROM surfaces WHERE id='room-surface'",
            )
            .first(),
        ).resolves.toEqual({ publishedRevisionId: "room-revision" });
        await expect(d1.prepare("SELECT design_policy_version AS version FROM surface_revisions WHERE id='revision'").first()).resolves.toEqual({ version: DESIGN_POLICY_VERSION });
      }
    }, 60_000);
  }

  it("enforces link-code hash uniqueness and one-use compare-and-set in D1", async () => {
    const code = "A".repeat(32);
    const hash = await sha256(code);
    const now = Date.now();
    await d1
      .prepare(
        "INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_alice','active','none',?,?)",
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO identity_link_codes (id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('code-one','user_alice',?,'global',?,0,5,?)",
      )
      .bind(hash, now + 60_000, now)
      .run();
    await expect(
      d1
        .prepare(
          "INSERT INTO identity_link_codes (id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('code-two','user_bob',?,'global',?,0,5,?)",
        )
        .bind(hash, now + 60_000, now)
        .run(),
    ).rejects.toThrow();
    const store = createD1IdentityLinkStore(d1);
    const outcomes = await Promise.all([
      completeIdentityLink(store, {
        code,
        workspaceScope: "global",
        mcpSubject: "mcp_subject_one_123456",
      }),
      completeIdentityLink(store, {
        code,
        workspaceScope: "global",
        mcpSubject: "mcp_subject_two_123456",
      }),
    ]);
    expect(
      outcomes.filter((value) => value.linked),
      JSON.stringify(outcomes),
    ).toHaveLength(1);
  });

  it("enforces stored privacy and acceptance checks and defaults in D1", async () => {
    await insertUsers(d1);
    const now = Date.now();
    await d1
      .prepare(
        "INSERT INTO profiles (id,user_id,display_name,summary,created_at,updated_at) VALUES ('defaults','user_alice','Alice','Summary',?,?)",
      )
      .bind(now, now)
      .run();
    await expect(
      d1
        .prepare(
          "SELECT audience,allow_matching AS allowMatching,acceptance_mode AS acceptanceMode FROM profiles WHERE id='defaults'",
        )
        .first(),
    ).resolves.toEqual({
      audience: "private",
      allowMatching: 0,
      acceptanceMode: "manual",
    });
    await d1
      .prepare(
        "INSERT INTO taxonomy_versions (id,version,status,created_at) VALUES ('taxonomy-defaults',1,'active',?)",
      )
      .bind(now)
      .run();
    await d1
      .prepare(
        "INSERT INTO work_signals (id,user_id,taxonomy_version_id,free_text_summary,approved_at,expires_at,created_at,updated_at) VALUES ('signal-defaults','user_alice','taxonomy-defaults','Summary',?,?,?,?)",
      )
      .bind(now, now + 60_000, now, now)
      .run();
    await expect(
      d1
        .prepare(
          "SELECT audience,allow_matching AS allowMatching FROM work_signals WHERE id='signal-defaults'",
        )
        .first(),
    ).resolves.toEqual({ audience: "private", allowMatching: 0 });
    await d1
      .prepare(
        "INSERT INTO projects (id,owner_user_id,slug,title,summary,created_at,updated_at) VALUES ('project-defaults','user_alice','defaults','Defaults','Summary',?,?)",
      )
      .bind(now, now)
      .run();
    await expect(
      d1
        .prepare(
          "SELECT audience,allow_matching AS allowMatching FROM projects WHERE id='project-defaults'",
        )
        .first(),
    ).resolves.toEqual({ audience: "private", allowMatching: 0 });
    await expect(
      d1
        .prepare(
          "INSERT INTO profiles (id,user_id,display_name,summary,audience,created_at,updated_at) VALUES ('bad-audience','user_bob','Bob','Summary','connections',?,?)",
        )
        .bind(now, now)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "UPDATE work_signals SET audience='cohort' WHERE id='signal-defaults'",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "UPDATE projects SET audience='connections' WHERE id='project-defaults'",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare("UPDATE profiles SET allow_matching=2 WHERE id='defaults'")
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "UPDATE profiles SET acceptance_mode='automatic-ish' WHERE id='defaults'",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at) VALUES ('bad-app','user_alice','x','X','code','read_everything',?)",
        )
        .bind(now)
        .run(),
    ).rejects.toThrow();
  });

  it("seeds fictional builders and the community-created cohort through D1", async () => {
    const repositories = createD1Repositories(d1 as unknown as RepositoryD1);
    await seedRepositoryFixtures(repositories);
    await expect(
      repositories.profiles.findByIdForViewer(
        "profile_fixture_aya" as ProfileId,
        null,
      ),
    ).resolves.toMatchObject({
      displayName: "Aya (fixture)",
      audience: "public",
    });
    await expect(
      repositories.cohorts.findByIdForViewer(buildWeekFixture.id, null),
    ).resolves.toMatchObject({
      slug: "openai-build-week-2026",
      communityCreated: true,
    });
    await expect(
      d1.prepare("SELECT COUNT(*) AS count FROM connections").first(),
    ).resolves.toEqual({ count: 0 });
  });

  it("enforces active normalized identity-link uniqueness and permits relink only after revocation", async () => {
    const now = Date.now();
    await d1
      .prepare(
        "INSERT INTO identity_principals (id,channel,issuer,subject,workspace_scope,created_at) VALUES ('p1','mcp','buildmates_mcp','s1','global',?),('p2','mcp','buildmates_mcp','s2','global',?)",
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO identity_links (id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('l1','user_alice','p1','mcp','buildmates_mcp','stable','global',?)",
      )
      .bind(now)
      .run();
    await expect(
      d1
        .prepare(
          "INSERT INTO identity_links (id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('l2','user_alice','p2','mcp','buildmates_mcp','stable','global',?)",
        )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await d1
      .prepare("UPDATE identity_links SET revoked_at=? WHERE id='l1'")
      .bind(now + 1)
      .run();
    await expect(
      d1
        .prepare(
          "INSERT INTO identity_links (id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('l2','user_alice','p2','mcp','buildmates_mcp','stable','global',?)",
        )
        .bind(now + 2)
        .run(),
    ).resolves.toMatchObject({ success: true });
  });

  it("keeps D1 surface publication, Circle voting, and idempotency failure-atomic", async () => {
    await insertUsers(d1);
    const now = at.valueOf();
    const repositories = createD1Repositories(d1 as unknown as RepositoryD1);
    await d1
      .prepare(
        "INSERT INTO design_policies (id,version,source_hash,policy_json,created_at) VALUES ('atomic-policy','1','atomic-hash','{}',?)",
      )
      .bind(now)
      .run();
    await d1
      .prepare(
        "INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('atomic-profile-surface','user_alice','profile','atomic-profile',1,?,?)",
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO surface_revisions (id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,design_policy_version,spec_json,status,created_at) VALUES ('atomic-profile-revision','atomic-profile-surface',1,NULL,'user_alice','atomic-policy','1','{}','draft',?)",
      )
      .bind(now)
      .run();
    await d1
      .prepare(
        "CREATE TRIGGER fail_surface_revision_publish BEFORE UPDATE OF status ON surface_revisions WHEN NEW.status='published' BEGIN SELECT RAISE(ABORT,'simulated surface fault'); END",
      )
      .run();
    const publishInput = {
      actorId: alice.id,
      surfaceId: "atomic-profile-surface",
      revisionId: "atomic-profile-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    };
    await expect(
      repositories.surfaces.publishRevision(publishInput),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "SELECT published_revision_id AS publishedRevisionId FROM surfaces WHERE id='atomic-profile-surface'",
        )
        .first(),
    ).resolves.toEqual({ publishedRevisionId: null });
    await expect(
      d1
        .prepare(
          "SELECT status FROM surface_revisions WHERE id='atomic-profile-revision'",
        )
        .first(),
    ).resolves.toEqual({ status: "draft" });
    await d1.prepare("DROP TRIGGER fail_surface_revision_publish").run();
    const concurrentPublishes = await Promise.allSettled([
      repositories.surfaces.publishRevision(publishInput),
      repositories.surfaces.publishRevision(publishInput),
    ]);
    expect(
      concurrentPublishes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await expect(
      d1
        .prepare(
          "SELECT s.published_revision_id AS publishedRevisionId,r.status FROM surfaces s JOIN surface_revisions r ON r.id=s.published_revision_id WHERE s.id='atomic-profile-surface'",
        )
        .first(),
    ).resolves.toEqual({
      publishedRevisionId: "atomic-profile-revision",
      status: "published",
    });

    await d1
      .prepare(
        "INSERT INTO circles (id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES ('atomic-circle','Atomic','Fault fixture','active','vote',1,?,?)",
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES ('atomic-circle','user_alice','owner','active',?)",
      )
      .bind(now)
      .run();
    await d1
      .prepare(
        "INSERT INTO circle_proposals (id,circle_id,proposer_user_id,kind,payload_json,governance_version,status,created_at) VALUES ('atomic-proposal','atomic-circle','user_alice','design','{\"revisionId\":\"atomic-circle-revision\"}',1,'voting',?)",
      )
      .bind(now)
      .run();
    await d1
      .prepare(
        "CREATE TRIGGER fail_circle_tally BEFORE UPDATE OF status ON circle_proposals BEGIN SELECT RAISE(ABORT,'simulated circle fault'); END",
      )
      .run();
    const voteInput = {
      actorId: alice.id,
      proposalId: "atomic-proposal",
      vote: "approve" as const,
      at,
    };
    await expect(repositories.circles.vote(voteInput)).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "SELECT COUNT(*) AS count FROM circle_votes WHERE proposal_id='atomic-proposal'",
        )
        .first(),
    ).resolves.toEqual({ count: 0 });
    await expect(
      d1
        .prepare(
          "SELECT status FROM circle_proposals WHERE id='atomic-proposal'",
        )
        .first(),
    ).resolves.toEqual({ status: "voting" });
    await d1.prepare("DROP TRIGGER fail_circle_tally").run();
    await Promise.all([
      repositories.circles.vote(voteInput),
      repositories.circles.vote(voteInput),
    ]);
    await expect(
      d1
        .prepare(
          "SELECT COUNT(*) AS count FROM circle_votes WHERE proposal_id='atomic-proposal'",
        )
        .first(),
    ).resolves.toEqual({ count: 1 });
    await expect(
      d1
        .prepare(
          "SELECT status FROM circle_proposals WHERE id='atomic-proposal'",
        )
        .first(),
    ).resolves.toEqual({ status: "approved" });
    await d1
      .prepare(
        "INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('atomic-circle-surface','user_alice','circle','atomic-circle',1,?,?)",
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO surface_revisions (id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,design_policy_version,spec_json,status,created_at) VALUES ('atomic-circle-revision','atomic-circle-surface',1,NULL,'user_alice','atomic-policy','1','{}','draft',?)",
      )
      .bind(now)
      .run();
    await repositories.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "atomic-circle-surface",
      revisionId: "atomic-circle-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      proposalId: "atomic-proposal",
      at,
    });
    await expect(
      d1
        .prepare(
          "SELECT status FROM circle_proposals WHERE id='atomic-proposal'",
        )
        .first(),
    ).resolves.toEqual({ status: "published" });

    await d1
      .prepare(
        "CREATE TRIGGER fail_idempotency_insert BEFORE INSERT ON idempotency_keys BEGIN SELECT RAISE(ABORT,'simulated idempotency fault'); END",
      )
      .run();
    await expect(
      repositories.idempotency.begin({
        id: "atomic-idem",
        actorUserId: alice.id,
        operation: "atomic",
        keyHash: "key",
        requestHash: "request",
        expiresAt: later,
        at,
      }),
    ).rejects.toThrow();
  });
});

async function exerciseAllAggregates(r: BuildmatesRepositories) {
  for (const user of [alice, bob, charlie, operator])
    await r.users.create(user);
  await r.taxonomy.createVersion({
    id: "taxonomy-one",
    version: 1,
    status: "active",
    at,
  });
  await r.taxonomy.createTopic({
    id: "topic-rag",
    taxonomyVersionId: "taxonomy-one",
    slug: "rag",
    label: "Retrieval-augmented generation",
  });

  await r.profiles.create({
    actorId: alice.id,
    id: "profile-alice" as ProfileId,
    userId: alice.id,
    handle: "Alice",
    displayName: "Alice",
    summary: "Current retrieval work",
    audience: "suggested_connections",
    cohortScopeId: null,
    allowMatching: true,
    acceptanceMode: "manual",
  });
  await expect(
    r.profiles.create({
      actorId: bob.id,
      id: "profile-forged" as ProfileId,
      userId: alice.id,
      handle: "forged",
      displayName: "Forged",
      summary: "Forged",
      audience: "public",
      cohortScopeId: null,
      allowMatching: false,
      acceptanceMode: "manual",
    }),
  ).rejects.toThrow();
  await expect(
    r.profiles.create({
      actorId: bob.id,
      id: "profile-bob" as ProfileId,
      userId: bob.id,
      handle: "ALICE",
      displayName: "Bob",
      summary: "Duplicate handle",
      audience: "public",
      cohortScopeId: null,
      allowMatching: false,
      acceptanceMode: "manual",
    }),
  ).rejects.toThrow();
  await expect(
    r.profiles.create({
      actorId: bob.id,
      id: "profile-invalid" as ProfileId,
      userId: bob.id,
      handle: "bob",
      displayName: "Bob",
      summary: "Invalid",
      audience: "connections" as never,
      cohortScopeId: null,
      allowMatching: false,
      acceptanceMode: "automatic-ish" as never,
    }),
  ).rejects.toThrow();
  await expect(
    r.profiles.findByIdForViewer("profile-alice" as ProfileId, bob.id),
  ).resolves.toBeNull();

  await expect(
    r.connectedApps.save({
      actorId: bob.id,
      id: "bad-app-pref",
      userId: alice.id,
      appId: "github",
      displayName: "GitHub",
      category: "Projects and code",
      accessMode: "never",
      lastReviewedAt: at,
    }),
  ).rejects.toThrow();
  await r.connectedApps.save({
    actorId: alice.id,
    id: "app-pref",
    userId: alice.id,
    appId: "github",
    displayName: "GitHub",
    category: "Projects and code",
    accessMode: "allow_approved_work_signals",
    lastReviewedAt: at,
  });
  await expect(r.connectedApps.listForUser(alice.id)).resolves.toMatchObject([
    { appId: "github", accessMode: "allow_approved_work_signals" },
  ]);

  const cohortId = "cohort-one" as CohortId;
  await r.cohorts.create({
    actorId: alice.id,
    id: cohortId,
    slug: "cohort-one",
    name: "Cohort One",
    description: "Fixture cohort",
    visibility: "private",
    governanceVersion: 1,
    communityCreated: true,
  });
  await expect(r.cohorts.findByIdForViewer(cohortId, null)).resolves.toBeNull();
  await expect(
    r.cohorts.findByIdForViewer(cohortId, charlie.id),
  ).resolves.toBeNull();
  await expect(
    r.cohorts.setMembership({
      actorId: bob.id,
      cohortId,
      userId: bob.id,
      role: "member",
      status: "active",
    }),
  ).rejects.toThrow();
  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId,
    userId: bob.id,
    role: "member",
    status: "active",
  });
  await expect(r.cohorts.getActiveRole(cohortId, bob.id)).resolves.toBe(
    "member",
  );
  await expect(
    r.cohorts.setMembership({
      actorId: bob.id,
      cohortId,
      userId: bob.id,
      role: "owner",
      status: "left",
    }),
  ).rejects.toThrow();
  await expect(
    r.cohorts.createInvitation({
      actorId: bob.id,
      id: "bad-cohort-invite",
      cohortId,
      inviterUserId: alice.id,
      inviteeUserId: charlie.id,
      tokenHash: "bad-cohort-token",
      expiresAt: later,
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.cohorts.createInvitation({
    actorId: alice.id,
    id: "cohort-invite",
    cohortId,
    inviterUserId: alice.id,
    inviteeUserId: charlie.id,
    tokenHash: "cohort-token",
    expiresAt: later,
    createdAt: at,
  });
  await expect(
    r.cohorts.respondToInvitation("cohort-invite", charlie.id, "accepted", at),
  ).resolves.toEqual({ cohortId, membershipActivated: true });
  await expect(r.cohorts.getActiveRole(cohortId, charlie.id)).resolves.toBe(
    "member",
  );
  await expect(
    r.cohorts.findByIdForViewer(cohortId, charlie.id),
  ).resolves.toMatchObject({ name: "Cohort One" });
  await expect(
    r.cohorts.respondToInvitation("cohort-invite", charlie.id, "declined", at),
  ).resolves.toBeNull();

  await expect(
    r.workSignals.create({
      actorId: alice.id,
      id: "bad-signal",
      userId: alice.id,
      taxonomyVersionId: "taxonomy-one",
      summary: "Forged",
      audience: "public",
      cohortScopeId: null,
      allowMatching: true,
      expiresAt: later,
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.workSignals.create({
    actorId: alice.id,
    id: "signal",
    userId: alice.id,
    taxonomyVersionId: "taxonomy-one",
    summary: "Evaluating RAG retrieval",
    audience: "suggested_connections",
    cohortScopeId: null,
    allowMatching: true,
    expiresAt: later,
    createdAt: at,
  });
  await expect(r.workSignals.listVisible(alice.id, null, at)).resolves.toEqual(
    [],
  );
  await expect(
    r.workSignals.listVisible(alice.id, bob.id, at),
  ).resolves.toEqual([]);
  await expect(
    r.workSignals.listVisible(alice.id, charlie.id, at),
  ).resolves.toEqual([]);

  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId,
    userId: bob.id,
    role: "admin",
    status: "active",
  });
  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId,
    userId: charlie.id,
    role: "admin",
    status: "active",
  });
  await r.cohorts.createInvitation({
    actorId: alice.id,
    id: "privileged-cohort-invite",
    cohortId,
    inviterUserId: alice.id,
    inviteeUserId: charlie.id,
    tokenHash: "privileged-cohort-token",
    expiresAt: later,
    createdAt: at,
  });
  await r.cohorts.respondToInvitation(
    "privileged-cohort-invite",
    charlie.id,
    "accepted",
    at,
  );
  await expect(r.cohorts.getActiveRole(cohortId, charlie.id)).resolves.toBe(
    "admin",
  );
  await expect(
    r.cohorts.setMembership({
      actorId: bob.id,
      cohortId,
      userId: charlie.id,
      role: "owner",
      status: "active",
    }),
  ).rejects.toThrow();
  await expect(
    r.cohorts.setMembership({
      actorId: bob.id,
      cohortId,
      userId: alice.id,
      role: "member",
      status: "removed",
    }),
  ).rejects.toThrow();
  await expect(
    r.cohorts.setMembership({
      actorId: alice.id,
      cohortId,
      userId: alice.id,
      role: "owner",
      status: "left",
    }),
  ).rejects.toThrow();
  await expect(
    r.cohorts.transferOwnership({
      actorId: bob.id,
      cohortId,
      newOwnerUserId: charlie.id,
      demoteOldOwnerTo: "member",
    }),
  ).rejects.toThrow();
  await r.cohorts.transferOwnership({
    actorId: alice.id,
    cohortId,
    newOwnerUserId: charlie.id,
    demoteOldOwnerTo: "member",
  });
  await expect(r.cohorts.getActiveRole(cohortId, charlie.id)).resolves.toBe(
    "owner",
  );
  await expect(
    r.cohorts.transferOwnership({
      actorId: alice.id,
      cohortId,
      newOwnerUserId: bob.id,
      demoteOldOwnerTo: "member",
    }),
  ).rejects.toThrow();
  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId,
    userId: alice.id,
    role: "member",
    status: "left",
  });

  const concurrentCohortId = "cohort-concurrent" as CohortId;
  await r.cohorts.create({
    actorId: alice.id,
    id: concurrentCohortId,
    slug: "cohort-concurrent",
    name: "Concurrent cohort",
    description: "Ownership CAS fixture",
    visibility: "private",
    governanceVersion: 1,
    communityCreated: true,
  });
  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId: concurrentCohortId,
    userId: bob.id,
    role: "member",
    status: "active",
  });
  await r.cohorts.setMembership({
    actorId: alice.id,
    cohortId: concurrentCohortId,
    userId: charlie.id,
    role: "member",
    status: "active",
  });
  const cohortTransfers = await Promise.allSettled([
    r.cohorts.transferOwnership({
      actorId: alice.id,
      cohortId: concurrentCohortId,
      newOwnerUserId: bob.id,
      demoteOldOwnerTo: "member",
    }),
    r.cohorts.transferOwnership({
      actorId: alice.id,
      cohortId: concurrentCohortId,
      newOwnerUserId: charlie.id,
      demoteOldOwnerTo: "member",
    }),
  ]);
  expect(
    cohortTransfers.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const cohortRoles = await Promise.all([
    r.cohorts.getActiveRole(concurrentCohortId, bob.id),
    r.cohorts.getActiveRole(concurrentCohortId, charlie.id),
  ]);
  expect(cohortRoles.filter((role) => role === "owner")).toHaveLength(1);

  const projectId = "project-one" as ProjectId;
  await expect(
    r.projects.create({
      actorId: bob.id,
      id: "project-forged" as ProjectId,
      ownerUserId: alice.id,
      slug: "forged",
      title: "Forged",
      summary: "Forged",
      audience: "public",
      cohortScopeId: null,
      allowMatching: false,
      status: "active",
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.projects.create({
    actorId: alice.id,
    id: projectId,
    ownerUserId: alice.id,
    slug: "rag-evals",
    title: "RAG evals",
    summary: "Evaluation harness",
    audience: "suggested_connections",
    cohortScopeId: null,
    allowMatching: false,
    status: "active",
    createdAt: at,
  });
  await expect(
    r.projects.setCollaborator({
      actorId: bob.id,
      projectId,
      userId: bob.id,
      role: "editor",
      approvedAt: at,
    }),
  ).rejects.toThrow();
  await r.projects.setCollaborator({
    actorId: alice.id,
    projectId,
    userId: bob.id,
    role: "editor",
    approvedAt: at,
  });
  await expect(r.projects.getCollaboratorRole(projectId, bob.id)).resolves.toBe(
    "editor",
  );
  await expect(
    r.projects.findVisible(projectId, bob.id),
  ).resolves.toMatchObject({ title: "RAG evals" });
  await expect(r.projects.canEdit(projectId, bob.id)).resolves.toBe(true);
  await expect(r.projects.canEdit(projectId, charlie.id)).resolves.toBe(false);
  await r.projects.setCollaborator({
    actorId: alice.id,
    projectId,
    userId: bob.id,
    role: "editor",
    approvedAt: null,
  });
  await expect(r.projects.findVisible(projectId, bob.id)).resolves.toBeNull();
  await expect(r.projects.canEdit(projectId, bob.id)).resolves.toBe(false);

  await expect(
    r.invites.createLink({
      actorId: bob.id,
      id: "bad-invite",
      creatorUserId: alice.id,
      tokenHash: "bad-invite-token",
      kind: "builder",
      maximumUses: 1,
      expiresAt: later,
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.invites.createLink({
    actorId: alice.id,
    id: "invite",
    creatorUserId: alice.id,
    tokenHash: "invite-token",
    kind: "builder",
    maximumUses: 1,
    expiresAt: later,
    createdAt: at,
  });
  await expect(r.invites.consumeLink("invite-token", at)).resolves.toBe(true);
  await expect(r.invites.consumeLink("invite-token", at)).resolves.toBe(false);
  await expect(
    r.invites.createConnectionCard({
      actorId: bob.id,
      id: "bad-card",
      creatorUserId: alice.id,
      projectId,
      headline: "Forged",
      tokenHash: "bad-card-token",
      maximumUses: 1,
      expiresAt: later,
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.invites.createConnectionCard({
    actorId: alice.id,
    id: "card",
    creatorUserId: alice.id,
    projectId,
    headline: "Building RAG evals",
    tokenHash: "card-token",
    maximumUses: 1,
    expiresAt: later,
    createdAt: at,
  });
  await expect(
    r.invites.consumeConnectionCard("card-token", at),
  ).resolves.toMatchObject({
    id: "card",
    creatorUserId: alice.id,
    headline: "Building RAG evals",
  });
  await expect(
    r.invites.consumeConnectionCard("card-token", at),
  ).resolves.toBeNull();

  const forgedNetworking = [
    r.networking.savePulse({
      actorId: bob.id,
      id: "bad-pulse",
      userId: alice.id,
      intentSummary: "Forged",
      startsAt: at,
      expiresAt: later,
      at,
    }),
    r.networking.setBudget({
      actorId: bob.id,
      userId: alice.id,
      maximumPerWeek: 99,
      weekStartedAt: at,
    }),
    r.networking.addQuietHours({
      actorId: bob.id,
      id: "bad-quiet",
      userId: alice.id,
      timezone: "UTC",
      weekday: 1,
      startMinute: 0,
      endMinute: 1,
    }),
    r.networking.snooze({
      actorId: bob.id,
      id: "bad-snooze",
      userId: alice.id,
      startsAt: at,
      endsAt: later,
      at,
    }),
    r.networking.exclude({
      actorId: bob.id,
      id: "bad-exclude",
      userId: alice.id,
      kind: "company",
      normalizedValue: "forged",
      at,
    }),
    r.networking.watch({
      actorId: bob.id,
      id: "bad-watch",
      userId: alice.id,
      kind: "topic",
      targetId: "topic-rag",
      at,
    }),
    r.networking.follow({
      actorId: bob.id,
      userId: alice.id,
      targetKind: "project",
      targetId: projectId,
      at,
    }),
  ];
  for (const attempt of forgedNetworking)
    await expect(attempt).rejects.toThrow();
  await r.networking.savePulse({
    actorId: alice.id,
    id: "pulse",
    userId: alice.id,
    intentSummary: "Meet retrieval builders",
    startsAt: at,
    expiresAt: later,
    at,
  });
  await r.networking.setBudget({
    actorId: alice.id,
    userId: alice.id,
    maximumPerWeek: 3,
    weekStartedAt: at,
  });
  await r.networking.addQuietHours({
    actorId: alice.id,
    id: "quiet",
    userId: alice.id,
    timezone: "UTC",
    weekday: 1,
    startMinute: 0,
    endMinute: 480,
  });
  await r.networking.snooze({
    actorId: alice.id,
    id: "snooze",
    userId: alice.id,
    startsAt: at,
    endsAt: later,
    at,
  });
  await r.networking.exclude({
    actorId: alice.id,
    id: "exclude",
    userId: alice.id,
    kind: "company",
    normalizedValue: "acme",
    at,
  });
  await r.networking.watch({
    actorId: alice.id,
    id: "watch",
    userId: alice.id,
    kind: "topic",
    targetId: "topic-rag",
    at,
  });
  await r.networking.follow({
    actorId: alice.id,
    userId: alice.id,
    targetKind: "project",
    targetId: projectId,
    at,
  });

  await r.surfaces.createPolicy({
    id: DESIGN_POLICY_ID,
    version: DESIGN_POLICY_VERSION,
    sourceHash: DESIGN_POLICY_SOURCE_HASH,
    policyJson: DESIGN_POLICY_SOURCE,
    activatedAt: at,
    at,
  });
  await expect(
    r.surfaces.createSurface({
      actorId: bob.id,
      id: "bad-surface",
      ownerUserId: alice.id,
      kind: "profile",
      subjectId: "profile-alice",
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.createSurface({
    actorId: alice.id,
    id: "surface",
    ownerUserId: alice.id,
    kind: "profile",
    subjectId: "profile-alice",
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "revision",
    surfaceId: "surface",
    authorUserId: alice.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("profile"),
    createdAt: at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("revision", alice.id),
  ).resolves.toMatchObject({ revisionNumber: 1, designPolicyVersion: DESIGN_POLICY_VERSION });
  const historicalPolicy = SURFACE_POLICY_REGISTRY["2026-07-14.1"];
  await r.surfaces.createPolicy({ id: historicalPolicy.designPolicyId, version: historicalPolicy.version, sourceHash: historicalPolicy.sourceHash, policyJson: historicalPolicy.policyJson, activatedAt: new Date("2026-07-14T00:00:00Z"), at: new Date("2026-07-14T00:00:00Z") });
  await r.surfaces.createRevision({ actorId: alice.id, id: "historical-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 201, baseRevisionNumber: null, designPolicyId: historicalPolicy.designPolicyId, designPolicyVersion: historicalPolicy.version, specJson: surfaceSpecJson("profile", { designPolicyVersion: historicalPolicy.version }), createdAt: at });
  await expect(r.surfaces.findRevisionForViewer("historical-revision", alice.id)).resolves.toMatchObject({ designPolicyVersion: historicalPolicy.version });
  await r.surfaces.createPolicy({ id: "design_policy_unknown", version: "2099-01-01.1", sourceHash: "unknown-hash", policyJson: "{}", activatedAt: at, at });
  await expect(r.surfaces.createRevision({ actorId: alice.id, id: "unknown-policy-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 202, baseRevisionNumber: null, designPolicyId: "design_policy_unknown", designPolicyVersion: "2099-01-01.1", specJson: surfaceSpecJson("profile", { designPolicyVersion: "2099-01-01.1" }), createdAt: at })).rejects.toThrow("surface_revision_policy_mismatch");
  await expect(r.surfaces.createRevision({ actorId: alice.id, id: "invalid-spec-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 98, baseRevisionNumber: null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: DESIGN_POLICY_VERSION, specJson: "{}", createdAt: at })).rejects.toThrow("surface_spec_invalid");
  const deeplyNestedJson = '{"child":'.repeat(3_000) + "null" + "}".repeat(3_000);
  await expect(r.surfaces.createRevision({ actorId: alice.id, id: "deep-spec-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 97, baseRevisionNumber: null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: DESIGN_POLICY_VERSION, specJson: deeplyNestedJson, createdAt: at })).rejects.toThrow("surface_spec_invalid");
  await expect(r.surfaces.createRevision({ actorId: alice.id, id: "wrong-kind-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 99, baseRevisionNumber: null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: DESIGN_POLICY_VERSION, specJson: surfaceSpecJson("room"), createdAt: at })).rejects.toThrow("surface_revision_policy_mismatch");
  await expect(r.surfaces.createRevision({ actorId: alice.id, id: "wrong-version-revision", surfaceId: "surface", authorUserId: alice.id, revisionNumber: 100, baseRevisionNumber: null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: "forged", specJson: surfaceSpecJson("profile"), createdAt: at })).rejects.toThrow("surface_revision_policy_mismatch");
  await expect(
    r.surfaces.findRevisionForViewer("revision", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.surfaces.findRevisionForViewer("revision", null),
  ).resolves.toBeNull();
  await expect(
    r.surfaces.decideRevision({
      actorId: bob.id,
      revisionId: "revision",
      governanceVersion: 1,
      decision: "approved",
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.decideRevision({
    actorId: alice.id,
    revisionId: "revision",
    governanceVersion: 1,
    decision: "approved",
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "personal-revision",
    surfaceId: "surface",
    authorUserId: alice.id,
    revisionNumber: 50,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    visibility: "personal_view",
    specJson: surfaceSpecJson("profile"),
    createdAt: at,
  });
  await expect(
    r.surfaces.setPersonalView({
      actorId: bob.id,
      id: "bad-personal",
      surfaceId: "surface",
      revisionId: "personal-revision",
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.setPersonalView({
    actorId: alice.id,
    id: "personal",
    surfaceId: "surface",
    revisionId: "personal-revision",
    at,
  });
  await expect(
    r.surfaces.addAsset({
      actorId: bob.id,
      id: "bad-asset",
      ownerUserId: alice.id,
      objectKey: "bad.png",
      contentType: "image/png",
      byteSize: 1,
      sha256: "bad",
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.addAsset({
    actorId: alice.id,
    id: "asset",
    ownerUserId: alice.id,
    objectKey: "profiles/alice/image.png",
    contentType: "image/png",
    byteSize: 10,
    sha256: "asset-hash",
    at,
  });
  await expect(
    r.surfaces.createRevision({
      actorId: alice.id,
      id: "revision-two",
      surfaceId: "surface",
      authorUserId: alice.id,
      revisionNumber: 1,
      baseRevisionNumber: null,
      designPolicyId: DESIGN_POLICY_ID,
      designPolicyVersion: DESIGN_POLICY_VERSION,
      specJson: surfaceSpecJson("profile"),
      createdAt: at,
    }),
  ).rejects.toThrow();

  await r.matching.upsertBuilderIndex({
    actorId: alice.id,
    userId: alice.id,
    version: 1,
    taxonomyVersionId: "taxonomy-one",
    topicsJson: '["topic-rag"]',
    at,
  });
  await expect(
    r.matching.upsertBuilderIndex({
      actorId: bob.id,
      userId: alice.id,
      version: 2,
      taxonomyVersionId: "taxonomy-one",
      topicsJson: "[]",
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.matching.upsertBuilderIndex({
      actorId: alice.id,
      userId: alice.id,
      version: 1,
      taxonomyVersionId: "taxonomy-one",
      topicsJson: "[]",
      at,
    }),
  ).rejects.toThrow();
  await r.matching.recordPairScore({
    id: "score",
    userAId: alice.id,
    userBId: bob.id,
    indexVersionA: 1,
    indexVersionB: 1,
    taxonomyVersion: 1,
    weightVersion: 1,
    totalBasisPoints: 8000,
    expiresAt: later,
    at,
  });
  await expect(
    r.matching.recordPairScore({
      id: "reverse-score",
      userAId: bob.id,
      userBId: alice.id,
      indexVersionA: 1,
      indexVersionB: 1,
      taxonomyVersion: 1,
      weightVersion: 1,
      totalBasisPoints: 8000,
      expiresAt: later,
      at,
    }),
  ).rejects.toThrow();
  await r.matching.createCandidateBatch({
    actorId: alice.id,
    id: "batch",
    userId: alice.id,
    indexVersion: 1,
    taxonomyVersion: 1,
    candidateIdsJson: '["user_bob"]',
    expiresAt: later,
    at,
  });
  await expect(
    r.matching.createCandidateBatch({
      actorId: bob.id,
      id: "bad-batch",
      userId: alice.id,
      indexVersion: 1,
      taxonomyVersion: 1,
      candidateIdsJson: "[]",
      expiresAt: later,
      at,
    }),
  ).rejects.toThrow();
  await r.matching.createPair({
    id: "pair",
    userAId: alice.id,
    userBId: bob.id,
    createdAt: at,
  });
  await r.matching.recordMatchedProposal({
    proposalId: "proposal",
    matchId: "match",
    pairId: "pair",
    acceptanceModeA: "manual",
    acceptanceModeB: "full_autopilot",
    expiresAt: later,
    at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("revision", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.surfaces.publishRevision({
      actorId: bob.id,
      surfaceId: "surface",
      revisionId: "revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.publishRevision({
    actorId: alice.id,
    surfaceId: "surface",
    revisionId: "revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "revision-next",
    surfaceId: "surface",
    authorUserId: alice.id,
    revisionNumber: 2,
    baseRevisionNumber: 1,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("profile"),
    createdAt: at,
  });
  await expect(
    r.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "surface",
      revisionId: "revision-next",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.surfaces.findRevisionForViewer("revision", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.profiles.findByIdForViewer("profile-alice" as ProfileId, bob.id),
  ).resolves.toBeNull();
  await expect(
    r.projects.findVisible(projectId, bob.id),
  ).resolves.toBeNull();
  await expect(
    r.workSignals.listVisible(alice.id, bob.id, at),
  ).resolves.toEqual([]);
  await r.matching.createPair({
    id: "pair-crossed",
    userAId: alice.id,
    userBId: charlie.id,
    createdAt: at,
  });
  await r.matching.recordMatchedProposal({
    proposalId: "proposal-crossed",
    matchId: "match-crossed",
    pairId: "pair-crossed",
    acceptanceModeA: "manual",
    acceptanceModeB: "manual",
    expiresAt: later,
    at,
  });
  await r.matching.createPair({
    id: "pair-duplicate-proposal",
    userAId: bob.id,
    userBId: charlie.id,
    createdAt: at,
  });
  await expect(
    r.matching.recordMatchedProposal({
      proposalId: "proposal",
      matchId: "match-after-duplicate-proposal",
      pairId: "pair-duplicate-proposal",
      acceptanceModeA: "manual",
      acceptanceModeB: "manual",
      expiresAt: later,
      at,
    }),
  ).rejects.toThrow();
  await r.matching.recordMatchedProposal({
    proposalId: "proposal-after-duplicate-proposal",
    matchId: "match-after-duplicate-proposal",
    pairId: "pair-duplicate-proposal",
    acceptanceModeA: "manual",
    acceptanceModeB: "manual",
    expiresAt: later,
    at,
  });
  await expect(
    r.matching.recordEvaluation({
      actorId: charlie.id,
      id: "bad-evaluation",
      proposalId: "proposal",
      userId: charlie.id,
      decision: "approve",
      reasonSummary: "Unauthorized",
      indexVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.matching.recordEvaluation({
      actorId: bob.id,
      id: "forged-evaluation",
      proposalId: "proposal",
      userId: alice.id,
      decision: "approve",
      reasonSummary: "Forged",
      indexVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await r.matching.recordEvaluation({
    actorId: alice.id,
    id: "evaluation",
    proposalId: "proposal",
    userId: alice.id,
    decision: "approve",
    reasonSummary: "Relevant work",
    indexVersion: 1,
    at,
  });
  await r.matching.recordHumanResponse({
    actorId: alice.id,
    id: "human",
    proposalId: "proposal",
    userId: alice.id,
    response: "interested",
    at,
  });
  await expect(
    r.matching.recordHumanResponse({
      actorId: bob.id,
      id: "forged-human",
      proposalId: "proposal",
      userId: alice.id,
      response: "decline",
      at,
    }),
  ).rejects.toThrow();

  const connectionId = "connection" as ConnectionId;
  await expect(
    r.connections.createFromMatch({
      id: "connection-crossed" as ConnectionId,
      matchId: "match-crossed",
      expectedMatchPairId: "pair",
      at,
    }),
  ).rejects.toThrow();
  await r.connections.createFromMatch({
    id: connectionId,
    matchId: "match",
    expectedMatchPairId: "pair",
    at,
  });
  await expect(
    r.connections.createFromMatch({
      id: "connection-two" as ConnectionId,
      matchId: "match",
      expectedMatchPairId: "pair",
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.connections.findForMember(connectionId, charlie.id),
  ).resolves.toBeNull();
  await expect(
    r.connections.findForMember(connectionId, bob.id),
  ).resolves.toMatchObject({ state: "active" });
  await expect(
    r.connections.updateSide({
      actorId: bob.id,
      connectionId,
      userId: alice.id,
      muted: true,
      renewedRelevanceEnabled: false,
      at,
    }),
  ).rejects.toThrow();
  await r.connections.updateSide({
    actorId: alice.id,
    connectionId,
    userId: alice.id,
    muted: true,
    renewedRelevanceEnabled: false,
    at,
  });
  await expect(
    r.connections.savePrivateNote({
      actorId: bob.id,
      id: "bad-note",
      connectionId,
      ownerUserId: alice.id,
      body: "Forged",
      at,
    }),
  ).rejects.toThrow();
  await r.connections.savePrivateNote({
    actorId: alice.id,
    id: "note",
    connectionId,
    ownerUserId: alice.id,
    body: "Follow up",
    at,
  });
  await expect(
    r.connections.readPrivateNote("note", bob.id),
  ).resolves.toBeNull();
  await expect(r.connections.readPrivateNote("note", alice.id)).resolves.toBe(
    "Follow up",
  );
  await expect(
    r.connections.scheduleReminder({
      actorId: bob.id,
      id: "bad-reminder",
      connectionId,
      userId: alice.id,
      remindAt: later,
      at,
    }),
  ).rejects.toThrow();
  await r.connections.scheduleReminder({
    actorId: alice.id,
    id: "reminder",
    connectionId,
    userId: alice.id,
    remindAt: later,
    at,
  });
  await expect(
    r.connections.setUpdateSubscription({
      actorId: bob.id,
      connectionId,
      subscriberUserId: alice.id,
      subjectUserId: bob.id,
      enabled: true,
      at,
    }),
  ).rejects.toThrow();
  await r.connections.setUpdateSubscription({
    actorId: alice.id,
    connectionId,
    subscriberUserId: alice.id,
    subjectUserId: bob.id,
    enabled: true,
    at,
  });
  await expect(
    r.connections.requestReconnect({
      actorId: bob.id,
      id: "bad-reconnect",
      connectionId,
      requesterUserId: alice.id,
      at,
    }),
  ).rejects.toThrow();
  await r.connections.requestReconnect({
    actorId: alice.id,
    id: "reconnect",
    connectionId,
    requesterUserId: alice.id,
    at,
  });
  const mutualProjectId = "project-mutual" as ProjectId;
  await r.projects.create({
    actorId: alice.id,
    id: mutualProjectId,
    ownerUserId: alice.id,
    slug: "mutual-only",
    title: "Mutual context",
    summary: "Visible after a Connection",
    audience: "mutual_connections",
    cohortScopeId: null,
    allowMatching: false,
    status: "active",
    createdAt: at,
  });
  await expect(
    r.projects.findVisible(mutualProjectId, bob.id),
  ).resolves.toMatchObject({ audience: "mutual_connections" });
  await expect(
    r.projects.findVisible(mutualProjectId, charlie.id),
  ).resolves.toBeNull();

  const roomId = "room" as RoomId;
  await expect(
    r.rooms.createForConnection({
      id: "room-crossed" as RoomId,
      connectionId,
      expectedMatchPairId: "pair-crossed",
      at,
    }),
  ).rejects.toThrow();
  await r.rooms.createForConnection({
    id: roomId,
    connectionId,
    expectedMatchPairId: "pair",
    at,
  });
  await expect(
    r.rooms.createForConnection({
      id: "room-two" as RoomId,
      connectionId,
      expectedMatchPairId: "pair",
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.rooms.sendMessage({
      actorId: bob.id,
      id: "forged-message",
      roomId,
      senderUserId: alice.id,
      clientMessageId: "forged",
      body: "Forged",
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.rooms.sendMessage({
    actorId: alice.id,
    id: "message",
    roomId,
    senderUserId: alice.id,
    clientMessageId: "client-one",
    body: "Hello",
    createdAt: at,
  });
  await expect(
    r.rooms.sendMessage({
      actorId: alice.id,
      id: "message-two",
      roomId,
      senderUserId: alice.id,
      clientMessageId: "client-one",
      body: "Duplicate",
      createdAt: at,
    }),
  ).rejects.toThrow();
  await expect(r.rooms.listMessages(roomId, charlie.id)).resolves.toEqual([]);
  await expect(r.rooms.listMessages(roomId, bob.id)).resolves.toMatchObject([
    { body: "Hello" },
  ]);
  await expect(
    r.rooms.submitFeedback({
      actorId: bob.id,
      id: "bad-feedback",
      connectionId,
      userId: alice.id,
      useful: true,
      reasonsJson: "[]",
      at,
    }),
  ).rejects.toThrow();
  await r.rooms.submitFeedback({
    actorId: alice.id,
    id: "feedback",
    connectionId,
    userId: alice.id,
    useful: true,
    reasonsJson: '["relevant"]',
    at,
  });
  await expect(
    r.rooms.proposeUpgrade({
      actorId: bob.id,
      id: "bad-upgrade",
      roomId,
      proposerUserId: alice.id,
      modulesJson: "[]",
      explanation: "Forged",
      at,
    }),
  ).rejects.toThrow();
  await r.rooms.proposeUpgrade({
    actorId: alice.id,
    id: "upgrade",
    roomId,
    proposerUserId: alice.id,
    modulesJson: '["decision_log"]',
    explanation: "Keep decisions",
    at,
  });
  await r.surfaces.createSurface({
    actorId: alice.id,
    id: "room-surface",
    ownerUserId: alice.id,
    kind: "room",
    subjectId: roomId,
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "room-revision",
    surfaceId: "room-surface",
    authorUserId: alice.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("room"),
    createdAt: at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("room-revision", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.surfaces.setPersonalView({
      actorId: alice.id,
      id: "cross-surface-view",
      surfaceId: "surface",
      revisionId: "room-revision",
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.surfaces.decideRevision({
      actorId: bob.id,
      revisionId: "room-revision",
      governanceVersion: 2,
      decision: "approved",
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.decideRevision({
    actorId: bob.id,
    revisionId: "room-revision",
    governanceVersion: 1,
    decision: "approved",
    at,
  });
  await expect(
    r.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "room-surface",
      revisionId: "room-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.decideRevision({
    actorId: alice.id,
    revisionId: "room-revision",
    governanceVersion: 1,
    decision: "approved",
    at,
  });
  await r.surfaces.publishRevision({
    actorId: alice.id,
    surfaceId: "room-surface",
    revisionId: "room-revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    at,
  });
  await expect(
    r.surfaces.createRevision({
      actorId: alice.id,
      id: "stale-room-revision",
      surfaceId: "room-surface",
      authorUserId: alice.id,
      revisionNumber: 2,
      baseRevisionNumber: null,
      designPolicyId: DESIGN_POLICY_ID,
      designPolicyVersion: DESIGN_POLICY_VERSION,
      specJson: surfaceSpecJson("room"),
      createdAt: at,
    }),
  ).rejects.toThrow();
  await expect(
    r.surfaces.findRevisionForViewer("room-revision", bob.id),
  ).resolves.toMatchObject({ id: "room-revision" });

  const circleId = "circle" as CircleId;
  await r.circles.create({
    actorId: operator.id,
    id: circleId,
    name: "RAG builders",
    purpose: "Compare retrieval evaluations",
    governanceMode: "admin",
    at,
  });
  await expect(
    r.circles.setMembership({
      actorId: alice.id,
      circleId,
      userId: alice.id,
      role: "admin",
      status: "active",
    }),
  ).rejects.toThrow();
  await r.circles.setMembership({
    actorId: operator.id,
    circleId,
    userId: bob.id,
    role: "admin",
    status: "invited",
  });
  await expect(r.circles.getActiveRole(circleId, null)).resolves.toBeNull();
  await expect(r.circles.getActiveRole(circleId, bob.id)).resolves.toBeNull();
  await r.circles.setMembership({
    actorId: operator.id,
    circleId,
    userId: bob.id,
    role: "admin",
    status: "active",
  });
  await expect(r.circles.getActiveRole(circleId, bob.id)).resolves.toBe(
    "admin",
  );
  await expect(
    r.circles.setMembership({
      actorId: bob.id,
      circleId,
      userId: bob.id,
      role: "owner",
      status: "left",
    }),
  ).rejects.toThrow();
  await r.circles.setMembership({
    actorId: bob.id,
    circleId,
    userId: bob.id,
    role: "admin",
    status: "left",
  });
  await expect(r.circles.getActiveRole(circleId, bob.id)).resolves.toBeNull();
  await r.circles.setMembership({
    actorId: operator.id,
    circleId,
    userId: bob.id,
    role: "admin",
    status: "active",
  });
  await r.circles.setMembership({
    actorId: bob.id,
    circleId,
    userId: charlie.id,
    role: "member",
    status: "active",
  });
  await expect(
    r.circles.createProposal({
      actorId: alice.id,
      id: "bad-proposal",
      circleId,
      kind: "module",
      payloadJson: "{}",
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await r.circles.createProposal({
    actorId: bob.id,
    id: "circle-proposal",
    circleId,
    kind: "module",
    payloadJson: "{}",
    governanceVersion: 1,
    at,
  });
  await expect(
    r.circles.vote({
      actorId: alice.id,
      proposalId: "circle-proposal",
      vote: "approve",
      at,
    }),
  ).rejects.toThrow();
  await r.circles.vote({
    actorId: bob.id,
    proposalId: "circle-proposal",
    vote: "approve",
    at,
  });
  await expect(
    r.circles.addModule({
      actorId: charlie.id,
      id: "bad-module",
      circleId,
      kind: "decision_log",
      configJson: "{}",
      at,
    }),
  ).rejects.toThrow();
  await r.circles.addModule({
    actorId: bob.id,
    id: "module",
    circleId,
    kind: "decision_log",
    configJson: "{}",
    at,
  });
  await r.circles.addMetric({
    actorId: bob.id,
    id: "metric",
    circleId,
    name: "Experiments",
    ruleJson: "{}",
    at,
  });
  await r.circles.recordMetric({
    actorId: bob.id,
    id: "metric-entry",
    metricId: "metric",
    value: 1,
    periodKey: "2026-W29",
    at,
  });
  await expect(
    r.circles.setMembership({
      actorId: bob.id,
      circleId,
      userId: charlie.id,
      role: "owner",
      status: "active",
    }),
  ).rejects.toThrow();
  await expect(
    r.circles.setMembership({
      actorId: bob.id,
      circleId,
      userId: operator.id,
      role: "member",
      status: "removed",
    }),
  ).rejects.toThrow();
  await expect(
    r.circles.setMembership({
      actorId: operator.id,
      circleId,
      userId: operator.id,
      role: "owner",
      status: "left",
    }),
  ).rejects.toThrow();
  await expect(
    r.circles.transferOwnership({
      actorId: bob.id,
      circleId,
      newOwnerUserId: charlie.id,
      demoteOldOwnerTo: "member",
    }),
  ).rejects.toThrow();
  await r.circles.transferOwnership({
    actorId: operator.id,
    circleId,
    newOwnerUserId: bob.id,
    demoteOldOwnerTo: "member",
  });
  await expect(r.circles.getActiveRole(circleId, bob.id)).resolves.toBe(
    "owner",
  );
  await expect(
    r.circles.transferOwnership({
      actorId: operator.id,
      circleId,
      newOwnerUserId: charlie.id,
      demoteOldOwnerTo: "member",
    }),
  ).rejects.toThrow();
  await r.circles.setMembership({
    actorId: operator.id,
    circleId,
    userId: operator.id,
    role: "member",
    status: "left",
  });
  await r.surfaces.createSurface({
    actorId: bob.id,
    id: "circle-surface",
    ownerUserId: bob.id,
    kind: "circle",
    subjectId: circleId,
    at,
  });
  await r.surfaces.createRevision({
    actorId: bob.id,
    id: "circle-revision",
    surfaceId: "circle-surface",
    authorUserId: bob.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("circle"),
    createdAt: at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("circle-revision", charlie.id),
  ).resolves.toBeNull();
  await expect(
    r.surfaces.publishRevision({
      actorId: charlie.id,
      surfaceId: "circle-surface",
      revisionId: "circle-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await r.surfaces.publishRevision({
    actorId: bob.id,
    surfaceId: "circle-surface",
    revisionId: "circle-revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("circle-revision", charlie.id),
  ).resolves.toMatchObject({ id: "circle-revision" });

  const voteCircleId = "vote-circle" as CircleId;
  await r.circles.create({
    actorId: alice.id,
    id: voteCircleId,
    name: "Voted builders",
    purpose: "Test member governance",
    governanceMode: "vote",
    at,
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: voteCircleId,
    userId: bob.id,
    role: "member",
    status: "active",
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: voteCircleId,
    userId: charlie.id,
    role: "member",
    status: "active",
  });
  await r.surfaces.createSurface({
    actorId: alice.id,
    id: "vote-surface",
    ownerUserId: alice.id,
    kind: "circle",
    subjectId: voteCircleId,
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "vote-revision",
    surfaceId: "vote-surface",
    authorUserId: alice.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("circle"),
    createdAt: at,
  });
  await expect(
    r.circles.createProposal({
      actorId: bob.id,
      id: "stale-design-proposal",
      circleId: voteCircleId,
      kind: "design",
      payloadJson: '{"revisionId":"vote-revision"}',
      governanceVersion: 2,
      at,
    }),
  ).rejects.toThrow();
  await r.circles.createProposal({
    actorId: bob.id,
    id: "design-proposal",
    circleId: voteCircleId,
    kind: "design",
    payloadJson: '{"revisionId":"vote-revision"}',
    governanceVersion: 1,
    at,
  });
  await r.circles.vote({
    actorId: bob.id,
    proposalId: "design-proposal",
    vote: "approve",
    at,
  });
  await expect(
    r.surfaces.publishRevision({
      actorId: bob.id,
      surfaceId: "vote-surface",
      revisionId: "vote-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      proposalId: "design-proposal",
      at,
    }),
  ).rejects.toThrow();
  await r.circles.vote({
    actorId: alice.id,
    proposalId: "design-proposal",
    vote: "approve",
    at,
  });
  await r.surfaces.publishRevision({
    actorId: bob.id,
    surfaceId: "vote-surface",
    revisionId: "vote-revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    proposalId: "design-proposal",
    at,
  });
  const circleTransfers = await Promise.allSettled([
    r.circles.transferOwnership({
      actorId: alice.id,
      circleId: voteCircleId,
      newOwnerUserId: bob.id,
      demoteOldOwnerTo: "member",
    }),
    r.circles.transferOwnership({
      actorId: alice.id,
      circleId: voteCircleId,
      newOwnerUserId: charlie.id,
      demoteOldOwnerTo: "member",
    }),
  ]);
  expect(
    circleTransfers.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const circleRoles = await Promise.all([
    r.circles.getActiveRole(voteCircleId, bob.id),
    r.circles.getActiveRole(voteCircleId, charlie.id),
  ]);
  expect(circleRoles.filter((role) => role === "owner")).toHaveLength(1);

  await r.notifications.enqueue({
    id: "notification",
    userId: alice.id,
    kind: "match",
    delivery: "immediate",
    payloadJson: "{}",
    createdAt: at,
  });
  await expect(r.notifications.listForUser(bob.id)).resolves.toEqual([]);
  await expect(r.notifications.listForUser(alice.id)).resolves.toMatchObject([
    { kind: "match" },
  ]);
  await expect(
    r.automation.checkpoint({
      actorId: bob.id,
      id: "bad-checkpoint",
      userId: alice.id,
      kind: "work-pulse",
      cursor: "stolen",
      stateJson: "{}",
      at,
    }),
  ).rejects.toThrow();
  await r.automation.checkpoint({
    actorId: alice.id,
    id: "checkpoint",
    userId: alice.id,
    kind: "work-pulse",
    cursor: "cursor-1",
    stateJson: "{}",
    at,
  });
  await expect(
    r.automation.getCheckpoint(alice.id, "work-pulse"),
  ).resolves.toEqual({ cursor: "cursor-1", stateJson: "{}" });

  await expect(
    r.moderation.createReport({
      actorId: bob.id,
      id: "bad-report",
      reporterUserId: alice.id,
      targetKind: "user",
      targetId: charlie.id,
      reasonCode: "impersonation",
      status: "received",
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.moderation.createReport({
    actorId: alice.id,
    id: "report",
    reporterUserId: alice.id,
    targetKind: "user",
    targetId: bob.id,
    reasonCode: "impersonation",
    status: "received",
    createdAt: at,
  });
  await expect(
    r.moderation.findForReporter("report", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.moderation.findForReporter("report", alice.id),
  ).resolves.toMatchObject({ reasonCode: "impersonation" });
  await expect(
    r.moderation.openCase({
      actorId: alice.id,
      id: "bad-case",
      reportId: "report",
      at,
    }),
  ).rejects.toThrow();
  await r.moderation.openCase({
    actorId: operator.id,
    id: "case",
    reportId: "report",
    at,
  });
  await expect(
    r.moderation.recordAction({
      actorId: alice.id,
      id: "bad-action",
      caseId: "case",
      action: "hide",
      reasonCode: "impersonation",
      at,
    }),
  ).rejects.toThrow();
  await r.moderation.recordAction({
    actorId: operator.id,
    id: "action",
    caseId: "case",
    action: "hide",
    reasonCode: "impersonation",
    at,
  });
  await expect(
    r.moderation.appeal({
      actorId: charlie.id,
      id: "bad-appeal",
      caseId: "case",
      statement: "Unrelated",
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.moderation.appeal({
      actorId: operator.id,
      id: "operator-appeal",
      caseId: "case",
      statement: "Wrong path",
      at,
    }),
  ).rejects.toThrow();
  await r.moderation.appeal({
    actorId: bob.id,
    id: "appeal",
    caseId: "case",
    statement: "Review",
    at,
  });
  await expect(
    r.moderation.queueRedaction({
      actorId: bob.id,
      id: "bad-redaction",
      sourceKind: "work_signal",
      sourceId: "signal",
      at,
    }),
  ).rejects.toThrow();
  await r.moderation.queueRedaction({
    actorId: alice.id,
    id: "redaction",
    sourceKind: "work_signal",
    sourceId: "signal",
    at,
  });

  await expect(
    r.lifecycle.requestExport({
      actorId: bob.id,
      id: "bad-export",
      userId: alice.id,
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.lifecycle.requestDeletion({
      actorId: bob.id,
      id: "bad-delete",
      userId: alice.id,
      at,
    }),
  ).rejects.toThrow();
  await r.lifecycle.requestExport({
    actorId: alice.id,
    id: "export",
    userId: alice.id,
    at,
  });
  await r.lifecycle.requestDeletion({
    actorId: bob.id,
    id: "delete",
    userId: bob.id,
    at,
  });
  await expect(r.lifecycle.getJob("export", bob.id)).resolves.toBeNull();
  await expect(r.lifecycle.getJob("delete", bob.id)).resolves.toMatchObject({
    kind: "deletion",
    status: "queued",
  });

  const key = {
    id: "idem",
    actorUserId: alice.id,
    operation: "profile.update",
    keyHash: "key",
    requestHash: "request",
    expiresAt: later,
    at,
  };
  await expect(r.idempotency.begin(key)).resolves.toEqual({
    status: "acquired",
  });
  await expect(
    r.idempotency.begin({ ...key, id: "idem-two" }),
  ).resolves.toEqual({ status: "replay", responseJson: null });
  await expect(
    r.idempotency.begin({
      ...key,
      id: "idem-conflict",
      requestHash: "different",
    }),
  ).resolves.toEqual({ status: "conflict" });
  await expect(r.idempotency.complete("idem", bob.id, "{}", at)).resolves.toBe(
    false,
  );
  await expect(
    r.idempotency.complete("idem", alice.id, "{}", at),
  ).resolves.toBe(true);
  await expect(
    r.idempotency.complete("idem", alice.id, "{}", at),
  ).resolves.toBe(false);
  await expect(
    r.idempotency.begin({ ...key, id: "idem-replay" }),
  ).resolves.toEqual({ status: "replay", responseJson: "{}" });
  const expiringKey = {
    ...key,
    id: "idem-expiring",
    keyHash: "expired-key",
  };
  await expect(r.idempotency.begin(expiringKey)).resolves.toEqual({
    status: "acquired",
  });
  const afterExpiry = new Date(later.valueOf() + 1);
  const replacementExpiry = new Date(afterExpiry.valueOf() + 86_400_000);
  await expect(
    r.idempotency.begin({
      ...expiringKey,
      id: "idem-invalid-expiry",
      keyHash: "invalid-expiry-key",
      at: afterExpiry,
      expiresAt: afterExpiry,
    }),
  ).rejects.toThrow();
  const reuseAttempts = await Promise.all([
    r.idempotency.begin({
      ...expiringKey,
      id: "idem-reused",
      requestHash: "replacement",
      at: afterExpiry,
      expiresAt: replacementExpiry,
    }),
    r.idempotency.begin({
      ...expiringKey,
      id: "idem-reused-contender",
      requestHash: "contender",
      at: afterExpiry,
      expiresAt: replacementExpiry,
    }),
  ]);
  expect(
    reuseAttempts.filter((result) => result.status === "acquired"),
  ).toHaveLength(1);
  expect(
    reuseAttempts.filter((result) => result.status === "conflict"),
  ).toHaveLength(1);

  await r.audit.append({
    id: "audit",
    actorUserId: alice.id,
    action: "profile.updated",
    objectKind: "profile",
    objectId: "profile-alice",
    metadataJson: "{}",
    createdAt: at,
  });
  await expect(
    r.audit.listForObject("profile", "profile-alice"),
  ).resolves.toHaveLength(1);

  await expect(
    r.privateResources.create({
      actorId: bob.id,
      id: "bad-secret",
      ownerUserId: alice.id,
      value: "stolen",
      createdAt: at,
    }),
  ).rejects.toThrow();
  await r.privateResources.create({
    actorId: alice.id,
    id: "secret",
    ownerUserId: alice.id,
    value: "private",
    createdAt: at,
  });
  await expect(
    r.privateResources.readForOwner("secret", bob.id),
  ).resolves.toBeNull();
  await expect(
    r.privateResources.updateForOwner("secret", bob.id, "stolen"),
  ).resolves.toBe(false);

  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "blocked-room-revision",
    surfaceId: "room-surface",
    authorUserId: alice.id,
    revisionNumber: 2,
    baseRevisionNumber: 1,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("room"),
    createdAt: at,
  });
  for (const actorId of [alice.id, bob.id])
    await r.surfaces.decideRevision({
      actorId,
      revisionId: "blocked-room-revision",
      governanceVersion: 1,
      decision: "approved",
      at,
    });

  const blockedAdminCircleId = "blocked-admin-circle" as CircleId;
  await r.circles.create({
    actorId: alice.id,
    id: blockedAdminCircleId,
    name: "Blocked admin publication",
    purpose: "Block-aware publication parity",
    governanceMode: "admin",
    at,
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: blockedAdminCircleId,
    userId: bob.id,
    role: "member",
    status: "active",
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: blockedAdminCircleId,
    userId: charlie.id,
    role: "admin",
    status: "active",
  });
  await r.surfaces.createSurface({
    actorId: alice.id,
    id: "blocked-admin-surface",
    ownerUserId: alice.id,
    kind: "circle",
    subjectId: blockedAdminCircleId,
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "blocked-admin-revision",
    surfaceId: "blocked-admin-surface",
    authorUserId: alice.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("circle"),
    createdAt: at,
  });

  const blockedVoteCircleId = "blocked-vote-circle" as CircleId;
  await r.circles.create({
    actorId: alice.id,
    id: blockedVoteCircleId,
    name: "Blocked vote publication",
    purpose: "Block-aware publication parity",
    governanceMode: "vote",
    at,
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: blockedVoteCircleId,
    userId: bob.id,
    role: "member",
    status: "active",
  });
  await r.circles.setMembership({
    actorId: alice.id,
    circleId: blockedVoteCircleId,
    userId: charlie.id,
    role: "admin",
    status: "active",
  });
  await r.surfaces.createSurface({
    actorId: alice.id,
    id: "blocked-vote-surface",
    ownerUserId: alice.id,
    kind: "circle",
    subjectId: blockedVoteCircleId,
    at,
  });
  await r.surfaces.createRevision({
    actorId: alice.id,
    id: "blocked-vote-revision",
    surfaceId: "blocked-vote-surface",
    authorUserId: alice.id,
    revisionNumber: 1,
    baseRevisionNumber: null,
    designPolicyId: DESIGN_POLICY_ID,
    designPolicyVersion: DESIGN_POLICY_VERSION,
    specJson: surfaceSpecJson("circle"),
    createdAt: at,
  });
  await r.circles.createProposal({
    actorId: alice.id,
    id: "blocked-vote-proposal",
    circleId: blockedVoteCircleId,
    kind: "design",
    payloadJson: '{"revisionId":"blocked-vote-revision"}',
    governanceVersion: 1,
    at,
  });
  for (const actorId of [alice.id, bob.id, charlie.id])
    await r.circles.vote({
      actorId,
      proposalId: "blocked-vote-proposal",
      vote: "approve",
      at,
    });

  await expect(
    r.moderation.block({
      actorId: bob.id,
      blockerUserId: alice.id,
      blockedUserId: charlie.id,
      at,
    }),
  ).rejects.toThrow();
  await r.moderation.block({
    actorId: alice.id,
    blockerUserId: alice.id,
    blockedUserId: bob.id,
    at,
  });
  await expect(
    r.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "room-surface",
      revisionId: "blocked-room-revision",
      expectedPublishedRevisionNumber: 1,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "blocked-admin-surface",
      revisionId: "blocked-admin-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      at,
    }),
  ).rejects.toThrow();
  await expect(
    r.surfaces.publishRevision({
      actorId: alice.id,
      surfaceId: "blocked-vote-surface",
      revisionId: "blocked-vote-revision",
      expectedPublishedRevisionNumber: null,
      governanceVersion: 1,
      proposalId: "blocked-vote-proposal",
      at,
    }),
  ).rejects.toThrow();
  await r.circles.setMembership({
    actorId: charlie.id,
    circleId: blockedAdminCircleId,
    userId: bob.id,
    role: "member",
    status: "removed",
  });
  await r.circles.setMembership({
    actorId: charlie.id,
    circleId: blockedVoteCircleId,
    userId: bob.id,
    role: "member",
    status: "removed",
  });
  await r.surfaces.publishRevision({
    actorId: alice.id,
    surfaceId: "blocked-admin-surface",
    revisionId: "blocked-admin-revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    at,
  });
  await r.surfaces.publishRevision({
    actorId: alice.id,
    surfaceId: "blocked-vote-surface",
    revisionId: "blocked-vote-revision",
    expectedPublishedRevisionNumber: null,
    governanceVersion: 1,
    proposalId: "blocked-vote-proposal",
    at,
  });
  await expect(
    r.surfaces.findRevisionForViewer("blocked-room-revision", charlie.id),
  ).resolves.toBeNull();
  for (const revisionId of ["blocked-admin-revision", "blocked-vote-revision"])
    await expect(
      r.surfaces.findRevisionForViewer(revisionId, charlie.id),
    ).resolves.toMatchObject({ id: revisionId });
  await expect(
    r.profiles.findByIdForViewer("profile-alice" as ProfileId, bob.id),
  ).resolves.toBeNull();
  await r.moderation.block({
    actorId: bob.id,
    blockerUserId: bob.id,
    blockedUserId: charlie.id,
    at,
  });
  await expect(r.circles.getActiveRole(circleId, bob.id)).resolves.toBeNull();
}

async function applyMigrations(DB: D1Database) {
  for (const file of (await readdir("apps/web/drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const migration = await readFile(`apps/web/drizzle/${file}`, "utf8");
    for (const statement of migration
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean))
      await DB.prepare(statement).run();
  }
}

async function insertUsers(DB: D1Database) {
  const now = Date.now();
  await DB.prepare(
    "INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_alice','active','none',?,?),('user_bob','active','none',?,?)",
  )
    .bind(now, now, now, now)
    .run();
}
