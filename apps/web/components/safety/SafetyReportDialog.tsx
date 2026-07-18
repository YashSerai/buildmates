"use client";

import {
  FormEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./safety-report-dialog.module.css";

type ReportTargetKind =
  | "user"
  | "profile"
  | "project"
  | "room"
  | "circle"
  | "message";

type ReasonCode =
  | "spam"
  | "harassment"
  | "impersonation"
  | "unsafe_content"
  | "privacy"
  | "other";

const reasons: Array<{ value: ReasonCode; label: string }> = [
  { value: "harassment", label: "Harassment or unwanted contact" },
  { value: "spam", label: "Spam or misleading promotion" },
  { value: "impersonation", label: "Impersonation" },
  { value: "unsafe_content", label: "Unsafe or threatening content" },
  { value: "privacy", label: "Privacy concern" },
  { value: "other", label: "Another concern" },
];

export function SafetyReportDialog({
  targetKind,
  targetId,
  targetLabel,
  triggerLabel = "Report",
  triggerClassName,
  onSubmitted,
}: {
  targetKind: ReportTargetKind;
  targetId: string;
  targetLabel: string;
  triggerLabel?: string;
  triggerClassName?: string;
  onSubmitted?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const titleId = useId();
  const descriptionId = useId();
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"editing" | "submitting" | "submitted">(
    "editing",
  );
  const [error, setError] = useState("");

  function open() {
    setReasonCode("");
    setDetails("");
    setState("editing");
    setError("");
    dialog.current?.showModal();
  }

  function close() {
    if (state === "submitting") return;
    dialog.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reasonCode) {
      setError("Choose the reason that best describes the concern.");
      return;
    }

    setState("submitting");
    setError("");
    try {
      const response = await fetch("/api/safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "report",
          targetKind,
          targetId,
          reasonCode,
          ...(details.trim() ? { details: details.trim() } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          userFacingError(payload.error, "This report could not be submitted."),
        );
      }
      setState("submitted");
      onSubmitted?.();
    } catch (caught) {
      setState("editing");
      setError(
        caught instanceof Error
          ? caught.message
          : "This report could not be submitted. Check your connection and try again.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${triggerClassName ?? ""}`}
        onClick={open}
        disabled={!hydrated}
        data-hydrated={hydrated}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (state === "submitting") event.preventDefault();
        }}
      >
        {state === "submitted" ? (
          <div className={styles.receipt}>
            <p className={styles.kicker}>Report received</p>
            <h2 id={titleId}>Buildmates will review it.</h2>
            <p id={descriptionId}>
              Your report is private. Review status will appear under Safety in
              Settings. Buildmates does not share your report details with the
              person you reported.
            </p>
            <button type="button" className={styles.primary} onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <header>
              <p className={styles.kicker}>Safety report</p>
              <h2 id={titleId}>Report {targetLabel}</h2>
              <p id={descriptionId}>
                Tell Buildmates what happened. Reports are private and do not
                automatically block anyone or end a Connection.
              </p>
            </header>
            <label>
              What is the concern?
              <select
                value={reasonCode}
                onChange={(event) =>
                  setReasonCode(event.target.value as ReasonCode | "")
                }
                required
                autoFocus
              >
                <option value="">Choose a reason</option>
                {reasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What should the reviewer know? <span>Optional</span>
              <textarea
                rows={5}
                maxLength={2000}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Describe the message, behavior, or privacy concern."
              />
              <small>{details.length}/2000</small>
            </label>
            <p className={styles.error} role="alert">
              {error}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={close}
                disabled={state === "submitting"}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={state === "submitting"}
              >
                {state === "submitting" ? "Submitting…" : "Submit private report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

function emptySubscribe() {
  return () => undefined;
}
