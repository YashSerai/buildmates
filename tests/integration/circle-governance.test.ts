import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCircleModuleEntry,
  createCircle,
  createCircleProposal,
  getCircle,
  inviteCircleMember,
  publishCircleProposal,
  respondCircleInvite,
  voteCircleProposal,
} from "../../apps/web/src/circles/service";

describe("Circle governance and privacy", () => {
  let mf: Miniflare;
  let DB: D1Database;
  const now = Date.parse("2026-07-15T12:00:00Z");

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
    await expect(publishCircleProposal(DB,{actorId:"member",circleId:circle.id,proposalId:proposal.id,now:now+4})).rejects.toThrow("proposal_not_approved");
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+5});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+6});
    const moduleId = `circle-module-${proposal.id}`;
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM circle_modules WHERE id=?").bind(moduleId).first<{count:number}>())?.count).toBe(1);
    const entry = await addCircleModuleEntry(DB,{actorId:"member",circleId:circle.id,moduleId,payload:{decision:"Use hybrid retrieval"},now:now+7});
    expect(entry.id).toBeTruthy();
  });

  it("publishes vote-governed proposals only after a strict active-member majority", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Voice builders",purpose:"Explore real-time conversational systems",governanceMode:"vote",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    const proposal = await createCircleProposal(DB,{actorId:"owner",circleId:circle.id,kind:"design",payload:{direction:"quiet-editorial"},now:now+3});
    await voteCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,vote:"approve",now:now+4});
    await expect(publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+5})).rejects.toThrow("proposal_not_approved");
    await voteCircleProposal(DB,{actorId:"member",circleId:circle.id,proposalId:proposal.id,vote:"approve",now:now+6});
    await publishCircleProposal(DB,{actorId:"owner",circleId:circle.id,proposalId:proposal.id,now:now+7});
    expect((await DB.prepare("SELECT status FROM circle_proposals WHERE id=?").bind(proposal.id).first<{status:string}>())?.status).toBe("published");
  });

  it("fails closed when an active member blocks another active member", async () => {
    const circle = await createCircle(DB,{actorId:"owner",name:"Local builders",purpose:"Meet people building in the same city",governanceMode:"admin",now});
    await inviteCircleMember(DB,{actorId:"owner",circleId:circle.id,userId:"member",now:now+1});
    await respondCircleInvite(DB,{actorId:"member",circleId:circle.id,accept:true,now:now+2});
    await DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES ('member','owner',?)").bind(now+3).run();
    expect(await getCircle(DB,circle.id,"owner")).toBeNull();
    expect(await getCircle(DB,circle.id,"member")).toBeNull();
  });
});
