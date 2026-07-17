"use client";

import { useState } from "react";
import type { CandidateRow, MatchInboxRow } from "@/src/matching/service";
import styles from "./matches.module.css";
import polish from "./matches-polish.module.css";

export function MatchesClient({
  initialCandidates,
  initialProposals,
}: {
  initialCandidates: CandidateRow[];
  initialProposals: MatchInboxRow[];
}) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [proposals, setProposals] = useState(initialProposals);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const [candidateResponse, inboxResponse] = await Promise.all([
      fetch("/api/matches/candidates", { cache: "no-store" }),
      fetch("/api/matches/inbox", { cache: "no-store" }),
    ]);
    if (!candidateResponse.ok || !inboxResponse.ok) throw new Error();
    setCandidates(
      ((await candidateResponse.json()) as { candidates: CandidateRow[] })
        .candidates,
    );
    setProposals(
      ((await inboxResponse.json()) as { proposals: MatchInboxRow[] })
        .proposals,
    );
  }

  async function respond(
    proposalId: string,
    response: "interested" | "decline" | "undo",
  ) {
    setBusy(proposalId);
    setNotice("");
    try {
      const result = await fetch("/api/matches/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId, response }),
      });
      if (!result.ok) throw new Error();
      await refresh();
      setNotice(
        response === "interested"
          ? "You are interested. We will open a room when the introduction is ready."
          : response === "undo"
            ? "Interest withdrawn."
            : "Passed. We will not share a reason.",
      );
    } catch {
      setNotice(
        "Your response was not saved. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.layout}>
      <section aria-labelledby="proposals-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Introductions</p>
            <h2 id="proposals-title">In progress</h2>
          </div>
          <button
            className={styles.refresh}
            onClick={() =>
              void refresh().catch(() =>
                setNotice(
                  "Matches could not be refreshed. Check your connection and try again.",
                ),
              )
            }
          >
            Refresh
          </button>
        </div>
        {proposals.length ? (
          <div className={styles.stack}>
            {proposals.map((proposal) => (
              <article className={styles.proposal} key={proposal.proposalId}>
                <div>
                  <p className={styles.state}>{proposalState(proposal)}</p>
                  <h3>{proposal.candidateName}</h3>
                  <p>{proposal.candidateSummary}</p>
                </div>
                <dl>
                  <div>
                    <dt>Your review</dt>
                    <dd>{evaluationLabel(proposal.myEvaluation)}</dd>
                  </div>
                  <div>
                    <dt>Their review</dt>
                    <dd>{evaluationLabel(proposal.theirEvaluation)}</dd>
                  </div>
                </dl>
                {proposal.state === "pending" ? (
                  <div className={styles.actions}>
                    {proposal.myResponse === "interested" ? (
                      <button
                        onClick={() =>
                          void respond(proposal.proposalId, "undo")
                        }
                        disabled={busy === proposal.proposalId}
                      >
                        Withdraw interest
                      </button>
                    ) : (
                      <button
                        className={styles.primary}
                        onClick={() =>
                          void respond(proposal.proposalId, "interested")
                        }
                        disabled={busy === proposal.proposalId}
                      >
                        {busy === proposal.proposalId
                          ? "Saving..."
                          : "Interested"}
                      </button>
                    )}
                    <button
                      className={styles.pass}
                      onClick={() =>
                        void respond(proposal.proposalId, "decline")
                      }
                      disabled={busy === proposal.proposalId}
                    >
                      Pass
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No introductions in progress"
            body="When a promising introduction appears, you can review it here."
          />
        )}
      </section>
      <section aria-labelledby="candidates-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Your shortlist</p>
            <h2 id="candidates-title">Recommended builders</h2>
          </div>
        </div>
        {candidates.length ? (
          <div className={styles.stack}>
            {candidates.map((candidate) => {
              const prompt = `Open my current Buildmates shortlist and evaluate the recommendation for ${candidate.displayName}. Use the Buildmates matching workflow and my current preferences.`;
              return (
                <article className={styles.candidate} key={candidate.userId}>
                  <div className={styles.score} aria-hidden="true">
                    ↗
                  </div>
                  <div>
                    <h3>{candidate.displayName}</h3>
                    <p>{candidate.summary}</p>
                    {candidate.visibleReasons.length ? (
                      <ul>
                        {candidate.visibleReasons.map((reason) => (
                          <li key={reason}>{formatReason(reason)}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className={styles.privateReason}>
                        Based on interests you chose to share for
                        recommendations.
                      </span>
                    )}
                  </div>
                  <div className={polish.candidateActions}>
                    <a
                      href={`codex://open?prompt=${encodeURIComponent(prompt)}`}
                    >
                      Review in Codex
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(prompt)
                          .then(() => setNotice("Codex prompt copied."))
                          .catch(() =>
                            setNotice(
                              "Copy was blocked. Open Codex and ask it to review your Buildmates shortlist.",
                            ),
                          )
                      }
                    >
                      Copy prompt
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No strong match yet"
            body="Keep building your profile, invite someone you follow, or ask Codex to watch for someone relevant."
          />
        )}
      </section>
      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      <p>{body}</p>
      <div>
        <a href="/graph">Explore the build graph</a>
        <a href="/invite">Invite a builder</a>
      </div>
    </div>
  );
}
function formatReason(value: string) {
  return (
    (
      {
        topicOverlap: "Related current work",
        topicAdjacency: "Adjacent interests",
        toolDomainFit: "Related tools or domain",
        stageFit: "Similar building stage",
        intentFit: "Compatible networking intent",
        locationFit: "Location preference",
        cohortFit: "Shared community",
        offerNeedFit: "Compatible ways of collaborating",
      } as Record<string, string>
    )[value] ?? "Mutual relevance visible to both people"
  );
}
function evaluationLabel(value: MatchInboxRow["myEvaluation"]) {
  if (!value) return "Not reviewed";
  return value === "approve"
    ? "Recommended"
    : value === "decline"
      ? "Not recommended"
      : "Review later";
}
function proposalState(proposal: MatchInboxRow) {
  if (proposal.state !== "pending")
    return (
      (
        {
          matched: "Room opened",
          declined: "Introduction closed",
          expired: "Introduction expired",
          blocked: "Introduction unavailable",
        } as Record<string, string>
      )[proposal.state] ?? "Introduction closed"
    );
  if (!proposal.myEvaluation) return "Ready for review";
  if (
    proposal.myEvaluation === "approve" &&
    !proposal.canAutopilot &&
    !proposal.myResponse
  )
    return "Waiting for your response";
  if (!proposal.theirEvaluation) return "Waiting for their review";
  return "Waiting for their response";
}
