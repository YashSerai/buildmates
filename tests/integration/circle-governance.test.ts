import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MODULE_APPEARANCE, DESIGN_POLICY_VERSION, type SurfaceSpecV2 } from "@buildmates/surfaces";
import {
  addCircleModuleEntry,
  createCircle,
  createCircleProposal,
  deleteCircleModuleEntry,
  getCircle,
  inviteCircleMember,
  leaveCircle,
  listCircles,
  listCircleModuleEntries,
  manageCircleMember,
  publishCircleProposal,
  respondCircleInvite,
  sendCircleMessage,
  updateCircleModuleEntry,
  voteCircleProposal,
} from "../../apps/web/src/circles/service";
import { beginAccountDeletion } from "../../apps/web/src/privacy/account-deletion";
import { applyD1Migrations } from "../helpers/migrate-d1";

const circleDesignSpec: SurfaceSpecV2 = {
  schemaVersion: "2",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "circle",
  title: "Surface builders",
  theme: {
    mode: "light",
    colors: {
      canvas: "#fffdf7", surface: "#f1eee4", ink: "#171814", mutedInk: "#55584f",
      accent: "#cad7ad", accentInk: "#181b12", secondary: "#24251f", secondaryInk: "#ffffff",
      highlight: "#f6c445", highlightInk: "#171814", rule: "#aaa99f", focusInner: "#000000", focusOuter: "#ffffff",
    },
    typography: { display: "sturdy-slab", body: "warm-grotesk", data: "engine-mono", scale: "comfortable", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
    shape: { corners: "soft", density: "comfortable", border: "hairline" },
    atmosphere: { motif: "constellation", density: "present", tone: "accent", continuity: "page" },
    motion: { preset: "drift", durationMs: 8000, iterations: 2 },
  },
  root: {
    id: "circle-root", type: "section", tone: "canvas", layout: "flow", padding: "lg", bleed: false, minHeight: "auto", background: "paper-rule", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
    children: [{
      id: "circle-container", type: "container", width: "standard", align: "center", padding: "none", children: [{
        id: "circle-stack", type: "stack", gap: "lg", align: "start", justify: "start", width: "full", children: [
          { id: "circle-title", type: "heading", level: 1, binding: "circle.name", fallback: "Circle", size: "display", align: "start", width: "balanced", weight: "bold", lineHeight: "snug", tracking: "tight" },
          { id: "circle-purpose", type: "text", style: "lead", binding: "circle.purpose", fallback: "Shared purpose", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" },
          { id: "circle-members", type: "fact-list", binding: "circle.members", emptyMessage: "Members will appear when the Circle opens.", layout: "rail", emphasis: "quiet" },
        ],
      }],
    }],
  },
  bindingManifest: { content: [{ key: "circle.name", type: "text" }, { key: "circle.purpose", type: "text" }, { key: "circle.members", type: "facts" }], media: [] },
  approvedAssets: [],
  decorativeRegions: [],
  responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
  accessibility: { label: "Surface builders Circle", primaryHeadingNodeId: "circle-title", reducedMotion: "required" },
};

function interposeAfterFirst(base: D1Database, needle: string, mutation: () => Promise<void>): D1Database {
  let fired = false;
  const prepare = base.prepare.bind(base);
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, {
    get(target, property, receiver) {
      if (property === "bind") return (...values: unknown[]) => wrap(target.bind(...values));
      if (property === "first") return async () => {
        const row = await target.first();
        if (row && !fired) {
          fired = true;
          await mutation();
        }
        return row;
      };
      return Reflect.get(target, property, receiver);
    },
  }) as D1PreparedStatement;
  return { prepare(sql: string) { const statement = prepare(sql); return !fired && sql.includes(needle) ? wrap(statement) : statement; }, batch: base.batch.bind(base) } as unknown as D1Database;
}

describe("Circle governance and privacy", () => {
  let mf: Miniflare;
  let DB: D1Database;
  const now = Date.parse("2026-10-02T12:00:00Z");

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('owner','active','none',?,?),('member','active','none',?,?),('stranger','active','none',?,?)").bind(now,now,now,now,now,now).run();
    await DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,audience,allow_matching,created_at,updated_at) VALUES ('po','owner','Owner','Builds retrieval systems','public',1,?,?),('pm','member','Member','Builds evaluation tools','public',1,?,?),('ps','stranger','Stranger','Not invited','public',1,?,?)").bind(now,now,now,now,now,now).run();
  });
  afterEach(async () => mf.dispose());

  it("keeps invitations private and idempotent", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Retrieval builders",purpose:"Compare practical retrieval systems",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+2});
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id='member' AND kind='circle_invitation'").first<{count:number}>())?.count).toBe(1);
    expect(await DB.prepare("SELECT json_extract(payload_json,'$.circleName') AS circleName FROM notifications WHERE user_id='member' LIMIT 1").first()).toEqual({circleName:"Retrieval builders"});
    const invited = await getCircle(DB,circle.id,"member");
    expect(invited?.membershipStatus).toBe("invited");
    expect(invited?.members).toEqual([]);
    expect(await getCircle(DB,circle.id,"stranger")).toBeNull();
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+3});
    expect((await getCircle(DB,circle.id,"member"))?.members).toHaveLength(2);
  });

  it("serializes same-clock invitation responses without a duplicate governance bump", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Response race",purpose:"Keep invitation decisions single-writer",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    // Complete the competing same-clock decline after the accepting request has
    // performed its pre-read, but before it reaches the CAS batch.
    const raceDB = interposeAfterFirst(DB,"SELECT membership.status,circle.status AS circleStatus",async () => {
      await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:false,now:now+2});
    });
    await expect(respondCircleInvite(raceDB,{actorId:"member",circleId:circle.id,accept:true,now:now+2})).rejects.toThrow("invitation_unavailable");
    expect(await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id='member'").bind(circle.id).first()).toEqual({status:"declined"});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:2});
  });

  it("does not accept a pending invitation after owner deletion archives its Circle", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Archived response",purpose:"Keep deleted Circle content private",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await beginAccountDeletion(DB,"owner");
    expect(await DB.prepare("SELECT status FROM circles WHERE id=?").bind(circle.id).first()).toEqual({status:"archived"});
    await expect(respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2})).rejects.toThrow("invitation_unavailable");
    expect(await getCircle(DB,circle.id,"member")).toBeNull();
    expect(await listCircles(DB,"member")).toEqual([]);
    expect(await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id='member'").bind(circle.id).first()).toEqual({status:"invited"});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:1});
  });

  it("does not treat an already accepted member as active after Circle archival", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Archived accepted",purpose:"Keep archived Circle membership unavailable",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    await DB.prepare("UPDATE circles SET status='archived' WHERE id=?").bind(circle.id).run();
    await expect(respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+3})).rejects.toThrow("invitation_unavailable");
    expect(await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id='member'").bind(circle.id).first()).toEqual({status:"active"});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:2});
  });

  it("rate limits Circle creation at the shared service boundary", async () => {
    for (let index = 0; index < 5; index += 1) {
      await createCircle(DB, { actorId: "owner", name: `Circle ${index}`, purpose: "A bounded Circle creation test.", governanceMode: "admin", now: now + index });
    }
    await expect(createCircle(DB, { actorId: "owner", name: "Circle 6", purpose: "This creation should be throttled.", governanceMode: "admin", now: now + 6 })).rejects.toThrow("circle_create_rate_limited");
  });

  it("rate limits repeated Circle invitations at the shared service boundary", async () => {
    const circle = await createCircle(DB, { actorId: "owner", name: "Invitation limits", purpose: "Bound repeated Circle invitations.", governanceMode: "admin", now });
    for (let index = 0; index < 30; index += 1) {
      await inviteCircleMember(DB, { actorId: "owner", circleId: circle.id, userId: "member", now: now + index + 1 });
    }
    await expect(inviteCircleMember(DB, { actorId: "owner", circleId: circle.id, userId: "member", now: now + 31 })).rejects.toThrow("circle_invite_rate_limited");
  });

  it("requires an admin to publish in admin governance and activates a module once", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"RAG builders",purpose:"Share lessons from retrieval projects",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const proposal = await createCircleProposal(DB,{actorId:"member",circleId:circle.id,kind:"module",payload:{kind:"decision_log",config:{title:"Decisions"}},now:now+3});
    expect((await getCircle(DB,circle.id,"member"))?.proposals[0]?.canPublish).toBe(false);
    expect((await getCircle(DB,circle.id,"owner"))?.proposals[0]?.canPublish).toBe(true);
    await expect(publishCircleProposal(DB,{actorId:"member",circleId:circle.id,proposalId:proposal.id,now:now+4})).rejects.toThrow("forbidden");
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+5});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+6});
    const moduleId = `circle-module-${proposal.id}`;
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM circle_modules WHERE id=?").bind(moduleId).first<{count:number}>())?.count).toBe(1);
    const entry = await addCircleModuleEntry(DB,{actorId:"member",circleId:circle.id,moduleId,payload:{decision:"Use hybrid retrieval"},now:now+7});
    expect(entry.id).toBeTruthy();
  });

  it("retains an approved functional appearance when Circle governance activates a tool", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Shipping studio",purpose:"Keep experiments legible",governanceMode:"admin",now});
    const appearance={...DEFAULT_MODULE_APPEARANCE,concept:{source:"user_reference" as const,direction:"Approved functional experiment board with visible status and evidence hierarchy.",referenceLabel:"Shared experiment board",approvedByUser:true as const},layout:"cards" as const};
    const proposal=await createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"module",payload:{kind:"experiment_tracker",config:{title:"Experiment board",appearance}},now:now+1});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+2});
    const detail=await getCircle(DB,circle.id,"owner");
    expect(detail?.modules[0]?.config).toMatchObject({title:"Experiment board",appearance:{layout:"cards",concept:{source:"user_reference",approvedByUser:true}}});
  });

  it("rejects inaccessible or unapproved Circle tool appearances", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Safe studio",purpose:"Reject unsafe design configuration",governanceMode:"admin",now});
    await expect(createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"module",payload:{kind:"scoreboard",config:{title:"Unsafe",appearance:{...DEFAULT_MODULE_APPEARANCE,concept:{...DEFAULT_MODULE_APPEARANCE.concept,approvedByUser:false}}}},now:now+1})).rejects.toThrow("module_appearance_invalid");
  });

  it("stores open-ended change requests without treating them as publishable changes", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Agent builders",purpose:"Compare practical agent workflows",governanceMode:"admin",now});
    const request = await createCircleProposal(DB,{
      actorId:"owner",
      circleId:circle.id,
      kind:"request",
      payload:{change:"Add a place to compare reliability experiments",outcome:"Help members retain the evidence behind shared decisions"},
      now:now+1,
    });
    const detail=await getCircle(DB,circle.id,"owner");
    expect(detail?.proposals[0]).toMatchObject({
      id:request.id,
      kind:"request",
      status:"draft",
      canPublish:false,
      payload:{change:"Add a place to compare reliability experiments",outcome:"Help members retain the evidence behind shared decisions"},
    });
    await expect(publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:request.id,now:now+2})).rejects.toThrow("request_requires_codex_proposal");
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM circle_modules WHERE circle_id=?").bind(circle.id).first()).toEqual({count:0});
  });

  it("does not invalidate governance when a stale membership change has no effect", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Role builders",purpose:"Keep role changes and governance versions in sync",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    await manageCircleMember(DB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"promote"});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:3});
    await expect(manageCircleMember(DB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"promote"})).rejects.toThrow("member_unavailable");
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:3});
  });

  it("rolls back a role change when the member leaves between pre-read and CAS", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Role race",purpose:"Keep membership and governance aligned",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const raceDB = interposeAfterFirst(DB,"SELECT role,status FROM circle_memberships",async () => {
      await DB.prepare("UPDATE circle_memberships SET status='left' WHERE circle_id=? AND user_id='member'").bind(circle.id).run();
    });
    await expect(manageCircleMember(raceDB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"promote"})).rejects.toThrow("member_unavailable");
    expect(await DB.prepare("SELECT role,status FROM circle_memberships WHERE circle_id=? AND user_id='member'").bind(circle.id).first()).toEqual({role:"member",status:"left"});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:2});
  });

  it("does not promote after ownership transfer wins the pre-read", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Transfer race",purpose:"Keep ownership authority current",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const raceDB = interposeAfterFirst(DB,"SELECT role,status FROM circle_memberships",async () => {
      await manageCircleMember(DB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"transfer"});
    });
    await expect(manageCircleMember(raceDB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"promote"})).rejects.toThrow("member_unavailable");
    expect(await DB.prepare("SELECT user_id AS userId,role,status FROM circle_memberships WHERE circle_id=? ORDER BY user_id").bind(circle.id).all()).toMatchObject({results:[{userId:"member",role:"owner",status:"active"},{userId:"owner",role:"admin",status:"active"}]});
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:3});
  });

  it("rejects an ownership transfer when the Circle archives during its pre-read", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Archived transfer",purpose:"Keep archived ownership immutable",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const raceDB = interposeAfterFirst(DB,"SELECT role,status FROM circle_memberships",async () => {
      await DB.prepare("UPDATE circles SET status='archived' WHERE id=?").bind(circle.id).run();
    });
    await expect(manageCircleMember(raceDB,{actorId:"owner",circleId:circle.id,targetUserId:"member",action:"transfer"})).rejects.toThrow("transfer_failed");
    expect(await DB.prepare("SELECT user_id AS userId,role,status FROM circle_memberships WHERE circle_id=? ORDER BY user_id").bind(circle.id).all()).toMatchObject({results:[{userId:"member",role:"member",status:"active"},{userId:"owner",role:"owner",status:"active"}]});
    expect(await DB.prepare("SELECT governance_version AS version,status FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:2,status:"archived"});
  });

  it("creates a governed Surface and publishes a real private design revision", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Surface builders",purpose:"Govern a shared generated Circle page",governanceMode:"admin",now});
    expect(circle.surfaceId).toBe(`surface_circle_${circle.id}`);
    const proposal=await createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"design",payload:{title:"Quiet workshop",spec:circleDesignSpec},now:now+1});
    expect(await DB.prepare("SELECT visibility,status FROM surface_revisions WHERE id=?").bind(proposal.revisionId).first()).toEqual({visibility:"private_preview",status:"draft"});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+2});
    expect(await DB.prepare("SELECT published_revision_id AS revisionId FROM surfaces WHERE id=?").bind(circle.surfaceId).first()).toEqual({revisionId:proposal.revisionId});
  });

  it("versions approved rules and enforces author-only entry edits", async () => {
    const circle=await createCircle(DB,{actorId:"owner",name:"Shipping circle",purpose:"Track experiments and decisions together",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const moduleProposal=await createCircleProposal(DB,{actorId:"member",circleId:circle.id,kind:"module",payload:{kind:"experiment_tracker",config:{title:"RAG experiments"}},now:now+3});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:moduleProposal.id,now:now+4});
    const moduleId=`circle-module-${moduleProposal.id}`;
    const rules=await createCircleProposal(DB,{actorId:"member",circleId:circle.id,kind:"rules",payload:{moduleId,rules:{title:"Weekly progress",description:"Completed experiments rank above running work."}},now:now+5});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:rules.id,now:now+6});
    expect(await DB.prepare("SELECT rules_version AS version FROM circle_modules WHERE id=?").bind(moduleId).first()).toEqual({version:2});
    expect(await DB.prepare("SELECT version FROM circle_module_rule_versions WHERE proposal_id=?").bind(rules.id).first()).toEqual({version:2});
    const entry=await addCircleModuleEntry(DB,{actorId:"member",circleId:circle.id,moduleId,payload:{title:"Hybrid retrieval",hypothesis:"Reranking improves precision",status:"running"},now:now+7});
    await expect(updateCircleModuleEntry(DB,{actorId:"owner",circleId:circle.id,moduleId,entryId:entry.id,payload:{title:"Changed"},now:now+8})).rejects.toThrow("entry_not_found");
    await updateCircleModuleEntry(DB,{actorId:"member",circleId:circle.id,moduleId,entryId:entry.id,payload:{title:"Hybrid retrieval",status:"complete",outcome:"Precision improved"},now:now+9});
    await deleteCircleModuleEntry(DB,{actorId:"owner",circleId:circle.id,moduleId,entryId:entry.id,now:now+10});
    expect(await DB.prepare("SELECT deleted_at AS deletedAt FROM circle_module_entries WHERE id=?").bind(entry.id).first()).toEqual({deletedAt:now+10});
  });

  it("publishes vote-governed proposals only after a strict active-member majority", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Voice builders",purpose:"Explore real-time conversational systems",governanceMode:"vote",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const proposal = await createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"module",payload:{kind:"resource_shelf",config:{title:"Voice references"}},now:now+3});
    await voteCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,vote:"approve",now:now+4});
    await expect(publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+5})).rejects.toThrow("proposal_not_approved");
    await voteCircleProposal(DB,{actorId:"member",circleId:circle.id,proposalId:proposal.id,vote:"approve",now:now+6});
    expect((await getCircle(DB,circle.id,"member"))?.proposals[0]?.canPublish).toBe(false);
    expect((await getCircle(DB,circle.id,"owner"))?.proposals[0]?.canPublish).toBe(true);
    await expect(publishCircleProposal(DB,{actorId:"member",circleId:circle.id,proposalId:proposal.id,now:now+7})).rejects.toThrow("forbidden");
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+7});
    expect((await DB.prepare("SELECT status FROM circle_proposals WHERE id=?").bind(proposal.id).first<{status:string}>())?.status).toBe("published");
  });

  it("invalidates pending vote proposals when an active member leaves", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Governance builders",purpose:"Keep active membership aligned with every decision",governanceMode:"vote",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const proposal = await createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"module",payload:{kind:"decision_log",config:{title:"Decision log"}},now:now+3});
    await leaveCircle(DB,{actorId:"member",circleId:circle.id});
    await expect(voteCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,vote:"approve",now:now+4})).rejects.toThrow("proposal_unavailable");
    expect(await DB.prepare("SELECT governance_version AS version FROM circles WHERE id=?").bind(circle.id).first()).toEqual({version:3});
  });

  it("fails closed when an active member blocks another active member", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Local builders",purpose:"Meet people building in the same city",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    await DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES ('member','owner',?)").bind(now+3).run();
    expect(await getCircle(DB,circle.id,"owner")).toBeNull();
    expect(await getCircle(DB,circle.id,"member")).toBeNull();
    await expect(sendCircleMessage(DB,{actorId:"owner",circleId:circle.id,clientMessageId:"blocked-message",body:"This must not cross a block",now:now+4})).rejects.toThrow("forbidden");
    await expect(listCircleModuleEntries(DB,circle.id,"member")).rejects.toThrow("forbidden");
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE kind='circle_message'").first()).toEqual({count:0});

    const pending=await createCircle(DB,{actorId:"owner",name:"Pending circle",purpose:"Prove blocked invite acceptance fails closed",governanceMode:"admin",now:now+5});
    await inviteCircleMember(DB,{actorId:"owner",circleId:pending.id,userId:"stranger",now:now+6});
    await DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES ('stranger','owner',?)").bind(now+7).run();
    expect(await getCircle(DB,pending.id,"stranger")).toBeNull();
    await expect(respondCircleInvite(DB,{actorId:"stranger",circleId:pending.id,accept:true,now:now+8})).rejects.toThrow("invitation_blocked");
    expect(await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id='stranger'").bind(pending.id).first()).toEqual({status:"invited"});
  });
});
