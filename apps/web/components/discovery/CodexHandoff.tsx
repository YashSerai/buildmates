"use client";

import { useEffect, useState } from "react";
import { BUILDMATES_SETUP_PROMPT } from "../../src/product/codex-setup";

type CodexHandoffProps = {
  className?: string;
  label?: string;
};

export function CodexHandoff({
  className,
  label = "Set up with Codex",
}: CodexHandoffProps) {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  async function copyPrompt() {
    setOpen(true);
    try {
      await navigator.clipboard.writeText(BUILDMATES_SETUP_PROMPT);
      setStatus("Copied to your clipboard. Paste it into a new Codex task.");
    } catch {
      setStatus("Clipboard access was blocked. Select the prompt below to copy it.");
    }
  }

  return (
    <div className={className}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!ready}
        type="button"
        onClick={copyPrompt}
      >
        {label} <span aria-hidden="true">↗</span>
      </button>
      {open ? (
        <section
          aria-labelledby="buildmates-setup-toast-title"
          aria-modal="false"
          className="codex-setup-toast"
          role="dialog"
        >
          <header>
            <strong id="buildmates-setup-toast-title">Buildmates setup prompt</strong>
            <button
              aria-label="Close setup prompt"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>
          <p role="status" aria-live="polite">
            {status}
          </p>
          <textarea
            aria-label="Copied Buildmates setup prompt"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            rows={6}
            value={BUILDMATES_SETUP_PROMPT}
          />
        </section>
      ) : null}
    </div>
  );
}
