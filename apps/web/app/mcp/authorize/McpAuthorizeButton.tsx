"use client";

import { useState } from "react";
import styles from "../../info.module.css";

export function McpAuthorizeButton({ returnTo, disabled }: { returnTo: string; disabled: boolean }) {
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
  return <div>
    <button className={styles.action} type="button" disabled={disabled || status === "working"} onClick={authorize}>
      {status === "working" ? "Authorizing..." : "Authorize connection"}
    </button>
    {status === "error" && <p role="alert">The connection could not be authorized. Return to Codex and try the login again.</p>}
  </div>;
}
