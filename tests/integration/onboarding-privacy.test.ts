import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConflictError,
  getOnboardingSnapshot,
  mutateOnboarding,
  recordTrustedAutomationCapability,
  revokeSource,
  runPrivacyCommand,
  saveSourcePolicies,
} from "../../apps/web/src/platform/onboarding-data";
import { getProfileByHandle, saveProject } from "../../apps/web/src/profile-projects/service";

describe("onboarding and privacy persistence", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    const migrations = (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort();
    for (const migration of migrations) {
      const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
    }
  });

  afterEach(async () => { await mf.dispose(); });

  it("enforces setup order, persists the complete resume state, and records truthful autopilot capability", async () => {
    const userId = "user-onboarding";
    const pending = await getOnboardingSnapshot(DB, userId, "Avery");
    expect(pending.setup).toMatchObject({completedCount:0,nextStep:"identity_link",complete:false});
    await linkUser(DB,userId);
    await getOnboardingSnapshot(DB,userId,"Avery");
    await expect(mutateOnboarding(DB, userId, "Avery", { action: "save_context", method: "manual_profile", summary: "I build practical retrieval tools for small teams.", projectOrInterest: "Retrieval evaluation", links: [] })).rejects.toBeInstanceOf(ConflictError);

    await mutateOnboarding(DB, userId, "Avery", { action: "acknowledge_storage", acknowledged: true });
    await saveSourcePolicies(DB, userId, [], true);
    await mutateOnboarding(DB, userId, "Avery", { action: "save_context", method: "manual_profile", summary: "I build practical retrieval tools for small teams.", projectOrInterest: "Initial retrieval idea", links: ["https://example.com/work"] });
    await mutateOnboarding(DB, userId, "Avery", { action: "review_signals", signalIds: [] });
    await mutateOnboarding(DB, userId, "Avery", { action: "save_profile", handle: "avery_builder", displayName: "Avery", summary: "I build practical retrieval tools for small teams.", projectOrInterest: "Retrieval evaluation", audience: "public", allowMatching: true });
    expect((await getOnboardingSnapshot(DB,userId,"Avery")).profile?.projectOrInterest).toBe("Retrieval evaluation");
    expect(await getProfileByHandle(DB,"avery_builder",null)).toBeNull();
    await mutateOnboarding(DB, userId, "Avery", { action: "approve_preview", approved: true });
    expect(await getProfileByHandle(DB,"avery_builder",null)).toMatchObject({handle:"avery_builder",allowMatching:true});
    const signalNow=Date.now();await DB.prepare("INSERT INTO taxonomy_versions(id,version,status,created_at,activated_at) VALUES ('tax-profile',9,'active',?,?)").bind(signalNow,signalNow).run();await DB.batch([DB.prepare("INSERT INTO work_signals(id,user_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('suggested-signal',?,'tax-profile','Suggested connection context','suggested_connections',1,?,?,?,?)").bind(userId,signalNow,signalNow+86400000,signalNow,signalNow),DB.prepare("INSERT INTO work_signals(id,user_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('private-signal',?,'tax-profile','Private current work','private',1,?,?,?,?)").bind(userId,signalNow,signalNow+86400000,signalNow,signalNow),DB.prepare("INSERT INTO work_signals(id,user_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('expired-signal',?,'tax-profile','Expired work','suggested_connections',1,?,?,?,?)").bind(userId,signalNow-86400000,signalNow-1,signalNow,signalNow)]);expect((await getProfileByHandle(DB,"avery_builder",null))?.workSignals).toEqual([]);expect((await getProfileByHandle(DB,"avery_builder",userId))?.workSignals.map((signal)=>signal.summary)).toEqual(["Suggested connection context","Private current work"]);
    await mutateOnboarding(DB, userId, "Avery", { action: "save_networking", intentSummary: "Meet people comparing retrieval systems", similarAdjacent: 50, localGlobal: 50, serendipity: 30, maximumIntroductionsPerWeek: 3, builderSimilarity: "balanced", geography: "balanced", timezone: "UTC", quietStart: "22:00", quietEnd: "08:00", exclusions: [], avoidRepeatedClusters: true, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    await mutateOnboarding(DB, userId, "Avery", { action: "save_acceptance", mode: "full_autopilot" });
    await mutateOnboarding(DB, userId, "Avery", { action: "save_automation", cadence: "daily", enabled: true, sourceLivenessReviewed: true, capability: "available" });
    expect((await getOnboardingSnapshot(DB, userId, "Avery")).setup).toMatchObject({ complete: true, completedCount: 10, totalSteps: 10, nextStep: null });
    await mutateOnboarding(DB, userId, "Avery", { action: "complete_outcome" });
    expect(await DB.prepare("SELECT kind,target_id AS targetId,revoked_at AS revokedAt FROM watches WHERE user_id=?").bind(userId).first()).toEqual({kind:"relevant_builder",targetId:"network",revokedAt:null});

    const snapshot = await getOnboardingSnapshot(DB, userId, "Avery");
    expect(snapshot.setup).toMatchObject({ complete: true, completedCount: 10, totalSteps: 10, nextStep: null });
    expect(snapshot.profile).toMatchObject({ acceptanceMode: "full_autopilot", allowMatching: true });
    expect(snapshot.automation).toMatchObject({ enabled: true, cadence: "daily", capability: "approval_required", sourceLivenessReviewed: true });
    const automationState = await DB.prepare("SELECT state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind='buildmates'").bind(userId).first<{ stateJson: string }>();
    expect(JSON.parse(automationState!.stateJson)).toMatchObject({ capability: "approval_required", checkedAt: null });
    await recordTrustedAutomationCapability(DB,userId,"available");
    await mutateOnboarding(DB,userId,"Avery",{action:"save_automation",cadence:"weekly",enabled:true,sourceLivenessReviewed:true,capability:"automation_unavailable"});
    expect((await getOnboardingSnapshot(DB,userId,"Avery")).automation).toMatchObject({capability:"available",cadence:"weekly"});
    await mutateOnboarding(DB,userId,"Avery",{action:"save_automation",cadence:"weekly",enabled:true,sourceLivenessReviewed:true,requestCapabilityRecheck:true});
    expect((await getOnboardingSnapshot(DB,userId,"Avery")).automation).toMatchObject({capability:"approval_required"});
  }, 30_000);

  it("marks expired signals stale and atomically revokes a source plus its active signals", async () => {
    const userId = "user-revocation";
    await getOnboardingSnapshot(DB, userId, "River");
    await linkUser(DB,userId);
    await saveSourcePolicies(DB, userId, [{ appId: "github", displayName: "GitHub", category: "Projects and code", accessMode: "allow_approved_work_signals" }]);
    const now = Date.now();
    await DB.prepare("INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES ('tax-test',1,'active',?,?)").bind(now, now).run();
    await DB.batch([
      DB.prepare("INSERT INTO work_signals (id,user_id,source_app_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('signal-current',?,'github','tax-test','Building a RAG evaluator','private',1,?,?,?,?)").bind(userId, now, now + 86_400_000, now, now),
      DB.prepare("INSERT INTO work_signals (id,user_id,source_app_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('signal-stale',?,'github','tax-test','Old project context','private',1,?,?,?,?)").bind(userId, now - 172_800_000, now - 86_400_000, now - 172_800_000, now - 172_800_000),
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('other-user','active','none',?,?)").bind(now,now),
      DB.prepare("INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at) VALUES (?,1,'tax-test','[\"rag\"]','[]','[]','[]','[]',?),('other-user',1,'tax-test','[\"rag\"]','[]','[]','[]','[]',?)").bind(userId,now,now),
      DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES ('pair-revoke','other-user',?,?)").bind(userId,now),
      DB.prepare("INSERT INTO pair_scores(id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at) VALUES ('score-revoke','other-user',?,1,1,1,1,'{}','[]','[]',8000,?,?)").bind(userId,now+86400000,now),
      DB.prepare("INSERT INTO candidate_batches(id,user_id,index_version,taxonomy_version,candidate_ids_json,expires_at,created_at) VALUES ('batch-revoke','other-user',1,1,?, ?,?)").bind(JSON.stringify([userId]),now+86400000,now),
      DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('proposal-revoke','pair-revoke',1,1,1,1,1,'manual','manual','{}','{}','pending',?,?)").bind(now+86400000,now),
      DB.prepare("INSERT INTO notifications(id,user_id,kind,delivery,payload_json,created_at) VALUES ('notice-revoke','other-user','match_proposal','immediate',?,?)").bind(JSON.stringify({candidateUserId:userId}),now),
    ]);

    const before = await getOnboardingSnapshot(DB, userId, "River");
    expect(before.signals[0]?.sourceDisplayName).toBe("GitHub");
    expect(before.signals.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "signal-current", status: "available" }, { id: "signal-stale", status: "stale" }]);
    await revokeSource(DB, userId, "github");
    const after = await getOnboardingSnapshot(DB, userId, "River");
    expect(after.sources).toEqual([]);
    expect(after.signals.every((signal) => signal.status === "revoked")).toBe(true);
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM work_signals WHERE user_id=? AND revoked_at IS NOT NULL").bind(userId).first<{ count: number }>())?.count).toBe(2);
    expect(await DB.prepare("SELECT version,topics_json AS topics FROM builder_match_index WHERE user_id=?").bind(userId).first()).toMatchObject({version:2,topics:"[]"});
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM pair_scores WHERE user_a_id=? OR user_b_id=?").bind(userId,userId).first<{count:number}>())?.count).toBe(0);
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM candidate_batches WHERE id='batch-revoke'").first<{count:number}>())?.count).toBe(0);
    expect(await DB.prepare("SELECT state FROM match_proposals WHERE id='proposal-revoke'").first()).toMatchObject({state:"invalidated"});
    expect((await DB.prepare("SELECT read_at AS readAt FROM notifications WHERE id='notice-revoke'").first<{readAt:number|null}>())?.readAt).not.toBeNull();
  });

  it("replaces canonical networking controls and deletes projects from the privacy inventory",async()=>{
    const userId="user-controls";await getOnboardingSnapshot(DB,userId,"Sky");await linkUser(DB,userId);await getOnboardingSnapshot(DB,userId,"Sky");
    await mutateOnboarding(DB,userId,"Sky",{action:"acknowledge_storage",acknowledged:true});await saveSourcePolicies(DB,userId,[],true);await mutateOnboarding(DB,userId,"Sky",{action:"save_context",method:"manual_profile",summary:"Building developer collaboration tools with careful privacy controls.",projectOrInterest:"Builder networks",links:[]});await mutateOnboarding(DB,userId,"Sky",{action:"review_signals",signalIds:[]});await mutateOnboarding(DB,userId,"Sky",{action:"save_profile",handle:"sky_builder",displayName:"Sky",summary:"Building developer collaboration tools with careful privacy controls.",projectOrInterest:"Builder networks",audience:"public",allowMatching:true});await mutateOnboarding(DB,userId,"Sky",{action:"approve_preview",approved:true});
    const base={action:"save_networking",intentSummary:"Meet nearby builder network founders",similarAdjacent:50,localGlobal:50,serendipity:25,maximumIntroductionsPerWeek:2,builderSimilarity:"balanced",geography:"balanced",timezone:"UTC",avoidRepeatedClusters:true,expiresAt:new Date(Date.now()+86400000).toISOString()};
    await mutateOnboarding(DB,userId,"Sky",{...base,quietStart:"22:00",quietEnd:"08:00",exclusions:["hidden_user"],snoozedUntil:new Date(Date.now()+3600000).toISOString()});
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM quiet_hours WHERE user_id=?").bind(userId).first<{count:number}>())?.count).toBe(7);expect((await DB.prepare("SELECT COUNT(*) AS count FROM matching_exclusions WHERE user_id=?").bind(userId).first<{count:number}>())?.count).toBe(1);expect((await DB.prepare("SELECT COUNT(*) AS count FROM matching_snoozes WHERE user_id=?").bind(userId).first<{count:number}>())?.count).toBe(1);
    await mutateOnboarding(DB,userId,"Sky",{...base,quietStart:"00:00",quietEnd:"00:00",exclusions:[],snoozedUntil:null});
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM quiet_hours WHERE user_id=?").bind(userId).first<{count:number}>())?.count).toBe(0);expect((await DB.prepare("SELECT COUNT(*) AS count FROM matching_exclusions WHERE user_id=?").bind(userId).first<{count:number}>())?.count).toBe(0);expect((await DB.prepare("SELECT COUNT(*) AS count FROM matching_snoozes WHERE user_id=? AND ends_at>?").bind(userId,Date.now()).first<{count:number}>())?.count).toBe(0);
    await mutateOnboarding(DB,userId,"Sky",{action:"save_acceptance",mode:"full_autopilot"});await runPrivacyCommand(DB,userId,{command:"disable_autopilot"});expect((await getOnboardingSnapshot(DB,userId,"Sky")).profile?.acceptanceMode).toBe("manual");
    const pauseUntil=Date.now()+3_600_000;await runPrivacyCommand(DB,userId,{command:"pause_matching",until:new Date(pauseUntil).toISOString()});expect(await DB.prepare("SELECT reason,ends_at AS endsAt FROM matching_snoozes WHERE user_id=? AND reason='user_pause'").bind(userId).first()).toMatchObject({reason:"user_pause",endsAt:pauseUntil});
    await saveProject(DB,userId,{slug:"private-project",title:"Private Project",summary:"A project that can be deleted from privacy settings.",audience:"public",allowMatching:true,indexable:true,stage:"building",status:"active"});
    expect((await getOnboardingSnapshot(DB,userId,"Sky")).projects).toHaveLength(1);await runPrivacyCommand(DB,userId,{command:"delete_project",slug:"private-project"});expect((await getOnboardingSnapshot(DB,userId,"Sky")).projects).toHaveLength(0);
  });
});

async function linkUser(DB:D1Database,userId:string){const now=Date.now();const principal=`principal-${userId}`;await DB.batch([DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at) VALUES (?,'mcp','buildmates_mcp',?,'global',?)").bind(principal,userId,now),DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES (?,?,?,'mcp','buildmates_mcp',?,'global',?)").bind(`link-${userId}`,userId,principal,userId,now)]);}
