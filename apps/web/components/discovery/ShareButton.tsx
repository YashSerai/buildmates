"use client";

import { useState, useSyncExternalStore } from "react";

const subscribeToShareAvailability = () => () => undefined;

export function ShareButton({ label, title }: { label: string; title: string }) {
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const nativeShare = useSyncExternalStore(
    subscribeToShareAvailability,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function share() {
    const url = window.location.href;
    const subject = label.toLowerCase().includes("project") ? "Project" : "Profile";
    setError("");
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setAnnouncement(`${subject} shared.`);
        return;
      }
      await navigator.clipboard.writeText(url);
      setAnnouncement(`${subject} link copied.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Could not share this link.");
    }
  }

  const visibleLabel = nativeShare
    ? label
    : label === "Share profile"
      ? "Copy profile link"
      : label === "Share project"
        ? "Copy project link"
        : label.replace(/^Share\b/, "Copy");
  return (
    <span>
      <button type="button" onClick={() => void share()}>{visibleLabel}</button>
      <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
      {error ? <span role="alert">{error}</span> : null}
    </span>
  );
}
