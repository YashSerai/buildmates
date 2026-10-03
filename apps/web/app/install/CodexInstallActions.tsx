"use client";

import { useState } from "react";
import { CodexHandoff } from "../../components/discovery/CodexHandoff";
import styles from "./install.module.css";

export const BUILDMATES_MCP_ENDPOINT = "https://buildmates-mcp.yashserai1.workers.dev/mcp";

export function CodexInstallActions() {
  return (
    <div className={styles.handoff}>
      <CodexHandoff
        className={styles.actions}
        label="Copy setup prompt"
        pasteTarget="a new ChatGPT chat or Codex task"
      />
      <p className={styles.fallback}>
        The prompt gives your current host the setup instructions. You do not
        need to copy commands or choose a connection method.
      </p>
    </div>
  );
}

export function DirectMcpConnection() {
  const [status, setStatus] = useState("");

  async function copyConnectionUrl() {
    try {
      await navigator.clipboard.writeText(BUILDMATES_MCP_ENDPOINT);
      setStatus("Connection URL copied.");
    } catch {
      setStatus("Clipboard access was blocked. Select the URL above and copy it manually.");
    }
  }

  return (
    <div className={styles.connectionFallback}>
      <label className={styles.connectionLabel} htmlFor="buildmates-mcp-endpoint">Direct MCP connection URL</label>
      <div className={styles.connectionRow}>
        <input
          id="buildmates-mcp-endpoint"
          className={styles.connectionInput}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={BUILDMATES_MCP_ENDPOINT}
        />
        <button className={styles.connectionButton} type="button" onClick={() => void copyConnectionUrl()}>
          Copy connection URL
        </button>
      </div>
      <p className={styles.connectionStatus} role="status" aria-live="polite">{status}</p>
      <p className={styles.fallback}>Use this URL only in a host that offers a direct MCP connection field. The host still handles sign-in and consent.</p>
    </div>
  );
}
