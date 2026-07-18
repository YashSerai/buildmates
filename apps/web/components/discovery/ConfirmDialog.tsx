"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./confirm-dialog.module.css";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};

export function useConfirmDialog() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((next: Confirmation) => {
    resolver.current?.(false);
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);

  return {
    confirm,
    confirmationDialog: request ? (
      <ConfirmationDialog request={request} onAnswer={answer} />
    ) : null,
  };
}

export function useTextPromptDialog() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolver = useRef<((answer: string | null) => void) | null>(null);
  const prompt = useCallback((next: Confirmation) => {
    resolver.current?.(null);
    setRequest(next);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const answer = useCallback((value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);
  return {
    prompt,
    promptDialog: request ? <TextPromptDialog request={request} onAnswer={answer} /> : null,
  };
}

function ConfirmationDialog({
  request,
  onAnswer,
}: {
  request: Confirmation;
  onAnswer: (answer: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirmation-title"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
      onClick={(event) => {
        if (event.target === ref.current) onAnswer(false);
      }}
    >
      <div className={styles.panel}>
        <p className={styles.eyebrow}>Please confirm</p>
        <h2 id="confirmation-title">{request.title}</h2>
        <p>{request.description}</p>
        <div className={styles.actions}>
          <button type="button" onClick={() => onAnswer(false)}>Cancel</button>
          <button
            type="button"
            className={request.tone === "danger" ? styles.danger : styles.primary}
            onClick={() => onAnswer(true)}
            autoFocus
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function TextPromptDialog({ request, onAnswer }: { request: Confirmation; onAnswer: (answer: string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="prompt-title" onCancel={(event) => { event.preventDefault(); onAnswer(null); }}>
      <form className={styles.panel} onSubmit={(event) => { event.preventDefault(); const answer = value.trim(); if (answer) onAnswer(answer); }}>
        <p className={styles.eyebrow}>Operator record</p>
        <h2 id="prompt-title">{request.title}</h2>
        <p>{request.description}</p>
        <label className={styles.field}>Policy reason<input autoFocus required maxLength={160} value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <div className={styles.actions}>
          <button type="button" onClick={() => onAnswer(null)}>Cancel</button>
          <button type="submit" className={styles.primary}>{request.confirmLabel ?? "Continue"}</button>
        </div>
      </form>
    </dialog>
  );
}
