import { describe, expect, it } from "vitest";
import { acceptanceModeSchema, appAccessModeSchema, asUserId, assertAuthorized, audienceSchema, AuthorizationError, can } from "../../packages/domain/src";

const alice = asUserId("alice");
const bob = asUserId("bob");

describe("object authorization", () => {
  it("keeps private and owner mutations owner-only", () => {
    expect(can("read_private_resource", { actorId: alice, ownerId: alice })).toBe(true);
    expect(can("read_private_resource", { actorId: bob, ownerId: alice })).toBe(false);
    expect(can("mutate_owned_resource", { actorId: null, ownerId: alice })).toBe(false);
    expect(() => assertAuthorized("mutate_owned_resource", { actorId: bob, ownerId: alice }))
      .toThrow(AuthorizationError);
  });

  it("applies the canonical audience and independent cohort constraint", () => {
    expect(can("read_profile", { actorId: null, ownerId: alice }, "public")).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice }, "signed_in")).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice, suggestedConnection: true }, "suggested_connections")).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice, mutualConnection: true }, "mutual_connections")).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice }, "suggested_connections")).toBe(false);
    expect(can("read_profile", { actorId: bob, ownerId: alice }, "public", true)).toBe(false);
    expect(can("read_profile", { actorId: bob, ownerId: alice, sameCohort: true }, "public", true)).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice }, "private")).toBe(false);
    expect(can("read_profile", { actorId: alice, ownerId: alice, blocked: true }, "private")).toBe(true);
    expect(can("read_profile", { actorId: bob, ownerId: alice, mutualConnection: true, blocked: true }, "mutual_connections")).toBe(false);
  });

  it("uses current membership and roles for rooms and Circles", () => {
    expect(can("write_room", { actorId: alice, roomMemberIds: [alice, bob] })).toBe(true);
    expect(can("read_room", { actorId: bob, roomMemberIds: [alice] })).toBe(false);
    expect(can("read_circle", { actorId: bob, circleRole: "member" })).toBe(true);
    expect(can("read_circle", { actorId: null, circleRole: "member" })).toBe(false);
    expect(can("manage_circle", { actorId: bob, circleRole: "member" })).toBe(false);
    expect(can("manage_circle", { actorId: bob, circleRole: "admin" })).toBe(true);
    expect(can("delete_circle", { actorId: bob, circleRole: "admin" })).toBe(false);
    expect(can("delete_circle", { actorId: alice, circleRole: "owner" })).toBe(true);
  });

  it("rejects unrecognized privacy and acceptance state at runtime", () => {
    expect(audienceSchema.safeParse("public").success).toBe(true);
    expect(audienceSchema.safeParse("suggested_connections").success).toBe(true);
    expect(audienceSchema.safeParse("connections").success).toBe(false);
    expect(acceptanceModeSchema.safeParse("full_autopilot").success).toBe(true);
    expect(acceptanceModeSchema.safeParse("automatic-ish").success).toBe(false);
    expect(appAccessModeSchema.safeParse("approved_summaries").success).toBe(false);
    expect(appAccessModeSchema.safeParse("allow_approved_work_signals").success).toBe(true);
    expect(appAccessModeSchema.safeParse("read_everything").success).toBe(false);
  });
});
