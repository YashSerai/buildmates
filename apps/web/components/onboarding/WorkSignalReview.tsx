import { useState } from "react";
import type { OnboardingSnapshot } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

type Signal = OnboardingSnapshot["signals"][number];
export function WorkSignalReview({
  signals,
  onSave,
  onReject,
  busy,
}: {
  signals: Signal[];
  onSave: (signal: Signal) => void;
  onReject: (signal: Signal) => void;
  busy: boolean;
}) {
  if (!signals.length)
    return (
      <div className={styles.emptyState}>
        <strong>No Work Signals yet</strong>
        <p>
          You can finish a basic profile now. A later automation run can add
          approved summaries without exposing raw source content.
        </p>
      </div>
    );
  return (
    <div className={styles.signalList}>
      {signals
        .filter((signal) => signal.status !== "revoked")
        .map((signal) => (
          <SignalEditor
            key={signal.id}
            signal={signal}
            onSave={onSave}
            onReject={onReject}
            busy={busy}
          />
        ))}
    </div>
  );
}
function SignalEditor({
  signal,
  onSave,
  onReject,
  busy,
}: {
  signal: Signal;
  onSave: (signal: Signal) => void;
  onReject: (signal: Signal) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(signal);
  return (
    <article className={styles.signalCard}>
      <div className={styles.signalHeader}>
        <span><span className={styles.statusBadge} data-status={signal.status}>{signal.status}</span> From {signal.sourceDisplayName}</span>
        <time dateTime={signal.expiresAt}>
          Expires {formatDate(signal.expiresAt)}
        </time>
      </div>
      <label>
        Approved summary
        <textarea
          value={draft.summary}
          rows={3}
          maxLength={1200}
          onChange={(event) => {
            setDraft({ ...draft, summary: event.target.value });
          }}
        />
      </label>
      <div className={styles.twoColumns}>
        <label>
          Matching audience
          <select
            value={draft.audience}
            onChange={(event) => {
              setDraft({
                ...draft,
                audience: event.target.value as Signal["audience"],
              });
            }}
          >
            <option value="suggested_connections">Suggested connections</option>
            <option value="mutual_connections">Mutual connections</option>
            <option value="private">Only me</option>
          </select>
          <span>Work Signals are private matching context. They never appear on your public profile or in public discovery.</span>
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={draft.allowMatching}
            onChange={(event) => {
              setDraft({ ...draft, allowMatching: event.target.checked });
            }}
          />{" "}
          Use privately for matching
        </label>
      </div>
      <div className={styles.actionRow}>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={busy}
        >
          Save signal
        </button>
        <button
          className={styles.textButton}
          type="button"
          onClick={() => onReject(signal)}
          disabled={busy}
        >
          Keep outside Buildmates
        </button>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
