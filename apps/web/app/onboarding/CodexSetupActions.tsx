"use client";

import { useState } from "react";
import styles from "./onboarding.module.css";
import {
  BUILDMATES_APP_URL,
  BUILDMATES_CONTINUE_SETUP_PROMPT,
  BUILDMATES_SETUP_PROMPT,
} from "../../src/product/codex-setup";

export function CodexSetupActions({ complete, hasProgress }: { complete: boolean; hasProgress: boolean }) {
  const [copyStatus, setCopyStatus] = useState("");
  const prompt = hasProgress || complete
    ? BUILDMATES_CONTINUE_SETUP_PROMPT
    : BUILDMATES_SETUP_PROMPT;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("Prompt copied.");
    } catch {
      setCopyStatus("Copy was blocked. Select the prompt and copy it manually.");
    }
  }

  return (
    <div className={styles.codexActions}>
      <a className={styles.primaryLink} href={BUILDMATES_APP_URL} target="_blank" rel="noreferrer">
        {complete ? "Open Buildmates in Codex" : "Continue setup in Codex"}
      </a>
      <button className={styles.secondaryButton} type="button" onClick={copyPrompt}>
        Copy setup prompt
      </button>
      <label className={styles.promptField}>
        <span>Prompt to use in Codex</span>
        <textarea value={prompt} readOnly rows={7} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <p className={styles.copyStatus} role="status" aria-live="polite">{copyStatus}</p>
    </div>
  );
}
