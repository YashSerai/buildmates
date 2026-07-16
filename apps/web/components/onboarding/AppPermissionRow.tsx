import type { SourcePolicy } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

export type SourceDraft = { appId: string; displayName: string; category: string; accessMode: SourcePolicy };
export function AppPermissionRow({ source, onChange, onRemove, persisted }: { source: SourceDraft; onChange: (source: SourceDraft) => void; onRemove?: () => void; persisted?: boolean }) {
  return (
    <fieldset className={styles.permissionRow}>
      <legend>{source.displayName || "Unnamed source"}</legend>
      <div className={styles.sourceMeta}>
        <label>Source name<input value={source.displayName} onChange={(event) => onChange({ ...source, displayName: event.target.value })} maxLength={80} /></label>
        <label>Category<input value={source.category} onChange={(event) => onChange({ ...source, category: event.target.value })} maxLength={80} /></label>
      </div>
      <label>Buildmates source-use policy
        <select value={source.accessMode} onChange={(event) => onChange({ ...source, accessMode: event.target.value as SourcePolicy })}>
          <option value="never">Never use</option>
          <option value="ask_each_time">Ask each time</option>
          <option value="allow_approved_work_signals">Allow approved Work Signals</option>
          <option value="actions_only">Actions only</option>
        </select>
      </label>
      <p>{policyHelp[source.accessMode]}</p>
      {onRemove ? <button className={styles.textButton} type="button" onClick={onRemove}>{persisted ? "Revoke source" : "Remove"}</button> : null}
    </fieldset>
  );
}
const policyHelp: Record<SourcePolicy, string> = {
  never: "Buildmates workflows will not ask Codex to read this source.",
  ask_each_time: "Codex asks before each Work Pulse. Unattended runs skip this source.",
  allow_approved_work_signals: "Codex may submit concise summaries for your review. Raw source content is not sent.",
  actions_only:
    "Choose this only when Codex confirms the source supports an action. Buildmates does not use its context for matching.",
};
