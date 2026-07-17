import { CodexHandoff } from "../../components/discovery/CodexHandoff";
import { BUILDMATES_APP_URL } from "../../src/product/codex-setup";
import styles from "./install.module.css";

export function CodexInstallActions() {
  return (
    <div className={styles.handoff}>
      <CodexHandoff className={styles.actions} label="Set up with Codex" />
      <p className={styles.fallback}>
        If Codex cannot connect it automatically, open the{" "}
        <a href={BUILDMATES_APP_URL} target="_blank" rel="noreferrer">
          official Buildmates app
        </a>{" "}
        and run the same prompt again.
      </p>
    </div>
  );
}
