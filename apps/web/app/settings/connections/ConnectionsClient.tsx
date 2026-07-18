"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { IdentityConnectionStatus } from "@/src/platform/identity-connections";
import styles from "./connections.module.css";

type LinkCode = { code: string; expiresAt: string };
type RequestState = "idle" | "working" | "ready" | "error";

export function ConnectionsClient({ initialStatus }: { initialStatus: IdentityConnectionStatus }) {
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [status, setStatus] = useState(initialStatus);
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!linkCode || status.connected) return;
    const updateClock = () => {
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(linkCode.expiresAt) - Date.now()) / 1000)));
    };
    updateClock();
    const clock = window.setInterval(updateClock, 1000);
    const poll = window.setInterval(() => void refreshStatus(false), 5000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(poll);
    };
  }, [linkCode, status.connected]);

  async function createCode() {
    setRequestState("working");
    setMessage("");
    try {
      const response = await fetch("/api/identity/link-code", { method: "POST" });
      if (!response.ok) throw new Error(response.status === 429 ? "Too many codes requested. Try again in an hour." : "Could not create a link code.");
      const nextCode = (await response.json()) as LinkCode;
      setLinkCode(nextCode);
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(nextCode.expiresAt) - Date.now()) / 1000)));
      setRequestState("ready");
      setMessage("Code created. Return to Codex to finish linking.");
      window.requestAnimationFrame(() => codeRef.current?.focus());
    } catch (error) {
      setRequestState("error");
      setMessage(error instanceof Error ? error.message : "Could not create a link code.");
    }
  }

  async function copyCode() {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode.code);
      setMessage("Link code copied. Paste it in your Codex conversation.");
    } catch {
      setMessage("Copy was blocked. Select the code and copy it manually.");
    }
  }

  async function refreshStatus(announce = true) {
    try {
      const response = await fetch("/api/identity/link-code", { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error();
      const nextStatus = (await response.json()) as IdentityConnectionStatus;
      setStatus(nextStatus);
      if (nextStatus.connected) {
        setLinkCode(null);
        setRequestState("idle");
        setMessage("Buildmates is connected to Codex.");
      } else if (announce) {
        setMessage("Not connected yet. Complete the link in Codex, then check again.");
      }
    } catch {
      if (announce) setMessage("Could not check the connection. Try again.");
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Buildmates from Codex? Existing Buildmates data stays in your account.")) return;
    setRequestState("working");
    setMessage("");
    try {
      const response = await fetch("/api/identity/link-code", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setStatus({ connected: false, connectionCount: 0, linkedAt: null });
      setLinkCode(null);
      setRequestState("idle");
      setMessage("Codex disconnected. You can create a new secure link at any time.");
    } catch {
      setRequestState("error");
      setMessage("Could not disconnect Codex. Try again.");
    }
  }

  const expired = Boolean(linkCode && secondsLeft <= 0);

  return (
    <section className={styles.connectionPanel} aria-labelledby="connection-status-title" data-hydrated={hydrated}>
      <div className={styles.connectionLine} aria-hidden="true">
        <span className={styles.siteNode}>Buildmates</span>
        <span className={`${styles.line} ${status.connected ? styles.lineConnected : linkCode ? styles.linePending : ""}`} />
        <span className={`${styles.codexNode} ${status.connected ? styles.nodeConnected : ""}`}>Codex</span>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.statusHeader}>
          <div>
            <p className={styles.statusLabel}>Connection status</p>
            <h2 id="connection-status-title">
              {status.connected ? "Connected to Codex" : "Codex is not connected"}
            </h2>
          </div>
          <span className={`${styles.statusMark} ${status.connected ? styles.statusConnected : ""}`}>
            <span aria-hidden="true" />
            {status.connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {status.connected ? (
          <div className={styles.connectedActions}>
            <p>
              Buildmates in Codex can now use this account when you ask it to or when your approved Work Pulse runs.
              {status.linkedAt ? <> Linked <time dateTime={status.linkedAt}>{formatLinkedDate(status.linkedAt)}</time>.</> : null}
            </p>
            <button className={styles.dangerButton} type="button" onClick={disconnect} disabled={!hydrated || requestState === "working"}>
              {requestState === "working" ? "Disconnecting..." : "Disconnect Codex"}
            </button>
          </div>
        ) : linkCode && !expired ? (
          <div className={styles.codeStage}>
            <ol className={styles.steps}>
              <li><span>1</span><p><strong>Copy the one-time code</strong><br />It expires in {formatDuration(secondsLeft)}.</p></li>
              <li><span>2</span><p><strong>Return to the Codex conversation</strong><br />Paste the code and ask Buildmates to complete the link.</p></li>
            </ol>
            <div className={styles.codeRow}>
              <code ref={codeRef} className={styles.code} tabIndex={-1} aria-label={`One-time link code ${linkCode.code}`}>{linkCode.code}</code>
              <button className={styles.primaryButton} type="button" onClick={copyCode}>Copy code</button>
            </div>
            <button className={styles.textButton} type="button" onClick={() => void refreshStatus(true)}>Check connection</button>
          </div>
        ) : (
          <div className={styles.approvalStage}>
            <p>
              Create a one-time code only when you are ready to approve the link.
              The code expires after ten minutes and can be used once.
            </p>
            <button className={styles.primaryButton} type="button" onClick={createCode} disabled={!hydrated || requestState === "working"}>
              {!hydrated ? "Preparing secure connection..." : requestState === "working" ? "Creating secure code..." : expired ? "Create a new code" : "Approve and create code"}
            </button>
          </div>
        )}

        <p className={`${styles.liveMessage} ${requestState === "error" ? styles.errorMessage : ""}`} role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatLinkedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function emptySubscribe() {
  return () => undefined;
}
