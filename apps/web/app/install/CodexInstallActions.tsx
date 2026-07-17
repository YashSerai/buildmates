import { CodexHandoff } from "../../components/discovery/CodexHandoff";
import styles from "./install.module.css";

export function CodexInstallActions() {
  return (
    <div className={styles.handoff}>
      <CodexHandoff className={styles.actions} label="Set up with Codex" />
      <p className={styles.fallback}>
        Before the directory release, Codex can install the GitHub beta plugin
        or connect directly to the production MCP server. Both routes ask for
        your confirmation and use the same Buildmates account.
      </p>
    </div>
  );
}
