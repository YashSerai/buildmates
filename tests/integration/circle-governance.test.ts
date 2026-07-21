import { readFile, readdir } from "node:fs/promises";
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
  listCircleModuleEntries,
  manageCircleMember,
  publishCircleProposal,
  respondCircleInvite,
  sendCircleMessage,
  updateCircleModuleEntry,
  voteCircleProposal,
} from "../../apps/web/src/circles/service";

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

describe("Circle governance and privacy", () => {
  let mf: Miniflare;
  let DB: D1Database;
  const now = Date.parse("2026-07-18T12:00:00Z");

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    for (const file of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${file}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
    }
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
