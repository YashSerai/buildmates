"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CandidateRow, MatchInboxRow } from "@/src/matching/service";
import styles from "./matches.module.css";
import polish from "./matches-polish.module.css";

type RefreshState = "idle" | "checking" | "error";

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
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");

  const refresh = useCallback(async () => {
    setRefreshState("checking");
    try {
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
      setLastChecked(Date.now());
      setRefreshState("idle");
    } catch {
      setRefreshState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const proposalUserIds = useMemo(
    () => new Set(proposals.map((proposal) => proposal.candidateUserId)),
    [proposals],
  );
  const shortlist = candidates.filter(
    (candidate) => !proposalUserIds.has(candidate.userId),
  );
  const openProposals = proposals.filter(
    (proposal) => proposal.state === "pending",
  );
  const recentProposals = proposals.filter(
    (proposal) => proposal.state !== "pending",
  );
  const needsInterest = openProposals.filter(
    (proposal) =>
      proposal.myEvaluation === "approve" &&
      !proposal.canAutopilot &&
      !proposal.myResponse,
  ).length;

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
          ? "Interest saved. The room will open when the introduction is ready."
          : response === "undo"
            ? "Interest withdrawn."
            : "Passed. No reason is shared.",
      );
    } catch {
      setNotice("Your response was not saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.deskHeader}>
        <dl className={styles.summary} aria-label="Introduction summary">
          <div>
            <dt>Shortlist</dt>
            <dd>{shortlist.length}</dd>
          </div>
          <div>
            <dt>In progress</dt>
            <dd>{openProposals.length}</dd>
          </div>
          <div>
            <dt>Waiting on you</dt>
            <dd>{needsInterest}</dd>
          </div>
        </dl>
        <p className={styles.sync} aria-live="polite">
          {refreshState === "checking"
            ? "Checking for updates…"
            : refreshState === "error"
              ? "Could not update. Showing your last loaded shortlist."
              : lastChecked
                ? `Live · checked ${formatCheckedTime(lastChecked)}`
                : "Live"}
        </p>
      </div>

      <div className={styles.desk}>
        <section className={styles.shortlist} aria-labelledby="candidates-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Your shortlist</p>
              <h2 id="candidates-title">People to consider</h2>
            </div>
            <span>Review in Codex</span>
          </div>
          {shortlist.length ? (
            <div className={styles.stack}>
              {shortlist.map((candidate, index) => (
                <Candidate
                  candidate={candidate}
                  index={index}
                  key={candidate.userId}
                  setNotice={setNotice}
                />
              ))}
            </div>
          ) : (
            <Empty
              title="No new introductions to review"
              body="Your next Work Pulse will check again. You can update your profile or invite a builder whose work you follow."
            />
          )}
        </section>

        <aside className={styles.progress} aria-labelledby="proposals-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Introductions</p>
              <h2 id="proposals-title">In progress</h2>
            </div>
          </div>
          {openProposals.length ? (
            <div className={styles.progressStack}>
              {openProposals.map((proposal) => (
                <article className={styles.proposal} key={proposal.proposalId}>
                  <div>
                    <p className={styles.state}>{proposalState(proposal)}</p>
                    <h3>{proposal.candidateName}</h3>
                    <p>{proposal.candidateSummary}</p>
                  </div>
                  <dl className={styles.reviewState}>
                    <div>
                      <dt>Your Codex review</dt>
                      <dd>{evaluationLabel(proposal.myEvaluation)}</dd>
                    </div>
                    <div>
                      <dt>Their Codex review</dt>
                      <dd>{evaluationLabel(proposal.theirEvaluation)}</dd>
                    </div>
                  </dl>
                  <ProposalActions
                    proposal={proposal}
                    busy={busy}
                    respond={respond}
                  />
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.quietState}>
              <h3>No introductions are waiting.</h3>
              <p>
                When both Codex reviews find mutual relevance, the introduction
                will appear here.
              </p>
            </div>
          )}

          {recentProposals.length ? (
            <details className={styles.recent}>
              <summary>Recent introductions ({recentProposals.length})</summary>
              <div>
                {recentProposals.map((proposal) =>
                  proposal.state === "matched" ? (
                    <a href="/connections" key={proposal.proposalId}>
                      <span>{proposal.candidateName}</span>
                      <small>{proposalState(proposal)}</small>
                    </a>
                  ) : (
                    <p key={proposal.proposalId}>
                      <span>{proposal.candidateName}</span>
                      <small>{proposalState(proposal)}</small>
                    </p>
                  ),
                )}
              </div>
            </details>
          ) : null}
        </aside>
      </div>

      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}

function Candidate({
  candidate,
  index,
  setNotice,
}: {
  candidate: CandidateRow;
  index: number;
  setNotice: (notice: string) => void;
}) {
  const prompt = `Open my current Buildmates shortlist and evaluate the recommendation for ${candidate.displayName}. Use the Buildmates matching workflow and my current preferences.`;
  return (
    <article className={styles.candidate}>
      <div className={styles.order} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
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
            Based on interests you chose to use for recommendations.
          </span>
        )}
      </div>
      <div className={polish.candidateActions}>
        <a href={`codex://open?prompt=${encodeURIComponent(prompt)}`}>
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
}

function ProposalActions({
  proposal,
  busy,
  respond,
}: {
  proposal: MatchInboxRow;
  busy: string | null;
  respond: (
    proposalId: string,
    response: "interested" | "decline" | "undo",
  ) => Promise<void>;
}) {
  if (proposal.state !== "pending") return null;
  return (
    <div className={styles.actions}>
      {proposal.myResponse === "interested" ? (
        <button
          onClick={() => void respond(proposal.proposalId, "undo")}
          disabled={busy === proposal.proposalId}
        >
          Withdraw interest
        </button>
      ) : (
        <button
          className={styles.primary}
          onClick={() => void respond(proposal.proposalId, "interested")}
          disabled={busy === proposal.proposalId}
        >
          {busy === proposal.proposalId ? "Saving…" : "Interested"}
        </button>
      )}
      <button
        className={styles.pass}
        onClick={() => void respond(proposal.proposalId, "decline")}
        disabled={busy === proposal.proposalId}
      >
        Pass
      </button>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      <p>{body}</p>
      <div>
        <a href="/graph">Open the build graph</a>
        <a href="/invite">Invite a builder</a>
      </div>
    </div>
  );
}

function formatCheckedTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
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
  if (!proposal.myEvaluation) return "Ready for Codex review";
  if (
    proposal.myEvaluation === "approve" &&
    !proposal.canAutopilot &&
    !proposal.myResponse
  )
    return "Your interest is needed";
  if (!proposal.theirEvaluation) return "Waiting for their Codex review";
  return "Waiting for their interest";
}
