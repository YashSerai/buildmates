import { describe, expect, it } from "vitest";
import { asUserId, can } from "../../packages/domain/src";

const owner = asUserId("owner");
const member = asUserId("member");
const outsider = asUserId("outsider");

describe("authorization matrix", () => {
  it("fails closed across anonymous, outsider, blocked, member, admin, and owner states", () => {
    expect(can("read_profile", { actorId: null, ownerId: owner }, "public")).toBe(true);
    expect(can("read_profile", { actorId: null, ownerId: owner }, "signed_in")).toBe(false);
    expect(can("read_profile", { actorId: outsider, ownerId: owner }, "private")).toBe(false);
    expect(can("read_profile", { actorId: outsider, ownerId: owner, mutualConnection: true, blocked: true }, "mutual_connections")).toBe(false);
    expect(can("read_profile", { actorId: owner, ownerId: owner, blocked: true }, "private")).toBe(true);
    expect(can("read_room", { actorId: outsider, roomMemberIds: [owner, member] })).toBe(false);
    expect(can("write_room", { actorId: member, roomMemberIds: [owner, member] })).toBe(true);
    expect(can("read_circle", { actorId: outsider, circleRole: null })).toBe(false);
    expect(can("manage_circle", { actorId: member, circleRole: "member" })).toBe(false);
    expect(can("manage_circle", { actorId: member, circleRole: "admin" })).toBe(true);
    expect(can("delete_circle", { actorId: member, circleRole: "admin" })).toBe(false);
    expect(can("delete_circle", { actorId: owner, circleRole: "owner" })).toBe(true);
  });

  it("treats cohort scope as an additional constraint, never a broader audience", () => {
    expect(can("read_profile", { actorId: member, ownerId: owner }, "public", true)).toBe(false);
    expect(can("read_profile", { actorId: member, ownerId: owner, sameCohort: true }, "public", true)).toBe(true);
    expect(can("read_profile", { actorId: member, ownerId: owner, sameCohort: true }, "private", true)).toBe(false);
  });
});
