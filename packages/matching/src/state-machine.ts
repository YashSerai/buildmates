export type AcceptanceMode = "manual" | "full_autopilot";
export type EvaluationDecision = "approve" | "decline" | "defer";
export type HumanResponse = "interested" | "decline" | null;
export type ProposalState = "pending" | "ready_to_open" | "matched" | "declined" | "expired" | "invalidated";
export type MatchSide = { evaluation: EvaluationDecision | null; humanResponse: HumanResponse; acceptanceMode: AcceptanceMode; autopilotCapable: boolean; matchingPaused: boolean };
export type ReciprocalProposal = { id: string; state: ProposalState; expiresAt: Date; evidenceVersionA: number; evidenceVersionB: number; a: MatchSide; b: MatchSide };

export function sideSatisfied(side: MatchSide): boolean {
  if (side.evaluation !== "approve" || side.matchingPaused) return false;
  return side.acceptanceMode === "full_autopilot" && side.autopilotCapable ? true : side.humanResponse === "interested";
}

export function deriveProposalState(proposal: ReciprocalProposal, now: Date): ProposalState {
  if (proposal.state !== "pending" && proposal.state !== "ready_to_open") return proposal.state;
  if (proposal.expiresAt.getTime() <= now.getTime()) return "expired";
  if (proposal.a.evaluation === "decline" || proposal.b.evaluation === "decline" || proposal.a.humanResponse === "decline" || proposal.b.humanResponse === "decline") return "declined";
  return sideSatisfied(proposal.a) && sideSatisfied(proposal.b) ? "ready_to_open" : "pending";
}

export function updateEvaluation(proposal: ReciprocalProposal, side: "a" | "b", decision: EvaluationDecision, expectedEvidenceVersion: number, now: Date): ReciprocalProposal {
  if (deriveProposalState(proposal, now) !== "pending") throw new Error("proposal_terminal_or_ready");
  const currentVersion = side === "a" ? proposal.evidenceVersionA : proposal.evidenceVersionB;
  if (currentVersion !== expectedEvidenceVersion) throw new Error("proposal_evidence_stale");
  const updated = { ...proposal, [side]: { ...proposal[side], evaluation: decision } };
  return { ...updated, state: deriveProposalState(updated, now) };
}

export function updateHumanResponse(proposal: ReciprocalProposal, side: "a" | "b", response: HumanResponse, now: Date): ReciprocalProposal {
  if (deriveProposalState(proposal, now) !== "pending") throw new Error("proposal_terminal_or_ready");
  const updated = { ...proposal, [side]: { ...proposal[side], humanResponse: response } };
  return { ...updated, state: deriveProposalState(updated, now) };
}

export function invalidateProposal(proposal: ReciprocalProposal): ReciprocalProposal {
  if (proposal.state === "matched" || proposal.state === "declined" || proposal.state === "expired") return proposal;
  return { ...proposal, state: "invalidated" };
}

export function markMatched(proposal: ReciprocalProposal, now: Date): ReciprocalProposal {
  if (deriveProposalState(proposal, now) !== "ready_to_open") throw new Error("proposal_not_ready");
  return { ...proposal, state: "matched" };
}
