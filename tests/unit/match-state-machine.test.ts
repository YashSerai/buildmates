import { describe, expect, it } from "vitest";
import { deriveProposalState, markMatched, updateEvaluation, updateHumanResponse, type AcceptanceMode, type ReciprocalProposal } from "../../packages/matching/src";

const now = new Date("2026-07-15T12:00:00Z");
function proposal(aMode: AcceptanceMode, bMode: AcceptanceMode, aCapable = true, bCapable = true): ReciprocalProposal {
  return { id: "proposal", state: "pending", expiresAt: new Date("2026-07-16T12:00:00Z"), evidenceVersionA: 2, evidenceVersionB: 4,
    a: { evaluation: null, humanResponse: null, acceptanceMode: aMode, autopilotCapable: aCapable, matchingPaused: false },
    b: { evaluation: null, humanResponse: null, acceptanceMode: bMode, autopilotCapable: bCapable, matchingPaused: false } };
}
const approveBoth = (value: ReciprocalProposal) => updateEvaluation(updateEvaluation(value, "a", "approve", 2, now), "b", "approve", 4, now);

describe("reciprocal match state machine", () => {
  it.each([
    ["manual", "manual", true, true], ["full_autopilot", "manual", false, true], ["manual", "full_autopilot", true, false], ["full_autopilot", "full_autopilot", false, false],
  ] as const)("covers %s/%s acceptance", (aMode, bMode, needA, needB) => {
    let value = approveBoth(proposal(aMode, bMode));
    expect(value.state).toBe(needA || needB ? "pending" : "ready_to_open");
    if (needA) value = updateHumanResponse(value, "a", "interested", now);
    if (needB) value = updateHumanResponse(value, "b", "interested", now);
    expect(value.state).toBe("ready_to_open");
    expect(markMatched(value, now).state).toBe("matched");
  });

  it("falls back to human acceptance when autopilot capability is unavailable", () => {
    let value = approveBoth(proposal("full_autopilot", "full_autopilot", false, true));
    expect(value.state).toBe("pending");
    value = updateHumanResponse(value, "a", "interested", now);
    expect(value.state).toBe("ready_to_open");
  });

  it("supports undo before opening and rejects stale or terminal updates", () => {
    let value = approveBoth(proposal("manual", "manual"));
    value = updateHumanResponse(value, "a", "interested", now);
    value = updateHumanResponse(value, "a", null, now);
    expect(value.state).toBe("pending");
    expect(() => updateEvaluation(value, "a", "approve", 99, now)).toThrow("proposal_evidence_stale");
    const declined = updateHumanResponse(value, "b", "decline", now);
    expect(declined.state).toBe("declined");
    expect(() => updateHumanResponse(declined, "b", null, now)).toThrow("proposal_terminal_or_ready");
  });

  it("expires and pauses without treating one side as the other", () => {
    const value = approveBoth(proposal("full_autopilot", "full_autopilot"));
    expect(deriveProposalState({ ...value, state: "pending", a: { ...value.a, matchingPaused: true } }, now)).toBe("pending");
    expect(deriveProposalState({ ...value, state: "pending" }, new Date("2026-07-17T00:00:00Z"))).toBe("expired");
  });
});
