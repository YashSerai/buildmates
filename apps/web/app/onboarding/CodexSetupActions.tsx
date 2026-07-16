"use client";

import { useState } from "react";
import styles from "./onboarding.module.css";

const SETUP_PROMPT = "Set up or resume Buildmates. Check my setup state first, then guide me through one next step at a time until my profile is reviewed and I have one useful next action.";
const BUILDMATES_APP_URL = "https://chatgpt.com/plugins/plugin_asdk_app_6a57d2ff080481918659b3355a3d9c0e";

export function CodexSetupActions({ complete }: { complete: boolean }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(SETUP_PROMPT);
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
        <textarea value={SETUP_PROMPT} readOnly rows={4} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <p className={styles.copyStatus} role="status" aria-live="polite">{copyStatus}</p>
    </div>
  );
}
