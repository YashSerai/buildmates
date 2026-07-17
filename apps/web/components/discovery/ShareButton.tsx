"use client";

import { useState } from "react";

export function ShareButton({ label, title }: { label: string; title: string }) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setStatus("Shared.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Could not share this link.");
    }
  }

  return <span><button type="button" onClick={() => void share()}>{label}</button><span role="status" aria-live="polite">{status}</span></span>;
}
