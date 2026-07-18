"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BUILDMATES_SETUP_PROMPT } from "../../src/product/codex-setup";
import styles from "./CodexHandoff.module.css";

type CodexHandoffProps = {
  className?: string;
  label?: string;
};

const subscribeToHydration = () => () => {};

export function CodexHandoff({
  className,
  label = "Set up with Codex",
}: CodexHandoffProps) {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

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
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.trigger}
        disabled={!ready}
        ref={triggerRef}
        type="button"
        onClick={copyPrompt}
      >
        {label} <span aria-hidden="true">↗</span>
      </button>
      {open ? (
        <div
          className={styles.backdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            aria-describedby="buildmates-setup-toast-status"
            aria-labelledby="buildmates-setup-toast-title"
            aria-modal="true"
            className={styles.dialog}
            ref={dialogRef}
            role="dialog"
          >
            <strong className={styles.title} id="buildmates-setup-toast-title">Buildmates setup prompt</strong>
            <button
              aria-label="Close setup prompt"
              className={styles.close}
              onClick={() => setOpen(false)}
              type="button"
            >
              <span aria-hidden="true">&times;</span>
            </button>
            <p className={styles.status} id="buildmates-setup-toast-status" role="status" aria-live="polite">
              {status}
            </p>
            <textarea
              aria-label="Copied Buildmates setup prompt"
              className={styles.prompt}
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              rows={6}
              value={BUILDMATES_SETUP_PROMPT}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
