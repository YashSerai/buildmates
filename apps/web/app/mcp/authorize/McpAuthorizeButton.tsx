"use client";

import { useState } from "react";
import styles from "./authorize.module.css";

export function McpAuthorizeButton({ returnTo }: { returnTo: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function authorize() {
    setStatus("working");
    const form = new FormData();
    form.set("return_to", returnTo);
    try {
      const response = await fetch("/api/identity/mcp-authorization", {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
      });
      const body = await response.json() as { location?: string };
      if (!response.ok || !body.location) throw new Error("authorization_failed");
      window.location.assign(body.location);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={styles.actionArea}>
      <button type="button" disabled={status === "working"} onClick={authorize}>
        <span>{status === "working" ? "Connecting..." : "Connect Codex"}</span>
        <i aria-hidden="true">↗</i>
      </button>
      <p className={styles.actionHelp}>You will return to Codex automatically when the connection is ready.</p>
      {status === "error" && <p className={styles.error} role="alert">The connection did not finish. Return to Codex and start it again.</p>}
    </div>
  );
}
