"use client";

import { useState } from "react";
import {
  BUILDMATES_APP_URL,
  BUILDMATES_SETUP_PROMPT,
} from "../../src/product/codex-setup";
import styles from "./install.module.css";

export function CodexInstallActions() {
  const [status, setStatus] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(BUILDMATES_SETUP_PROMPT);
      setStatus("Copied. Paste it into a new Codex task.");
    } catch {
      setStatus("Copy was blocked. Select the prompt below and copy it manually.");
    }
  }

  return (
    <div className={styles.handoff}>
      <div className={styles.actions}>
        <a href={BUILDMATES_APP_URL} target="_blank" rel="noreferrer">
          Open the official Buildmates app
        </a>
        <button type="button" onClick={copyPrompt}>
          Copy prompt for Codex
        </button>
      </div>
      <label className={styles.prompt}>
        <span>Prompt to paste into Codex</span>
        <textarea
          readOnly
          rows={7}
          value={BUILDMATES_SETUP_PROMPT}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
