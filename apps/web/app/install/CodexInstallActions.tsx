import { CodexHandoff } from "../../components/discovery/CodexHandoff";
import styles from "./install.module.css";

export function CodexInstallActions() {
  return (
    <div className={styles.handoff}>
      <CodexHandoff className={styles.actions} label="Set up with Codex" />
      <p className={styles.fallback}>
        The prompt gives Codex the current setup instructions. You do not need
        to copy commands or choose a connection method.
      </p>
    </div>
  );
}
