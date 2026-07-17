"use client";

import { useState } from "react";
import { BUILDMATES_SETUP_PROMPT } from "../../src/product/codex-setup";

type CodexHandoffProps = {
  className?: string;
  label?: string;
};

export function CodexHandoff({
  className,
  label = "Copy setup prompt",
}: CodexHandoffProps) {
  const [status, setStatus] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(BUILDMATES_SETUP_PROMPT);
      setStatus("Copied. Paste it into a new Codex task.");
    } catch {
      setStatus("Copy was blocked. Open the setup guide to copy it manually.");
    }
  }

  return (
    <span className={className}>
      <button type="button" onClick={copyPrompt}>
        {label}
      </button>
      <span role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}
