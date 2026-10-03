import type { AutomationCadence as Cadence } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

export function AutomationCadence({ value, onChange }: { value: Cadence; onChange: (value: Cadence) => void }) {
  return <div className={styles.stack}>
    <label>
      When should Work Pulse run?
      <select value={value} onChange={(event) => onChange(event.target.value as Cadence)}>
        <option value="manual">Only when I ask</option>
        <option value="twice_weekly">Twice a week</option>
        <option value="automatic">Daily check, quiet when nothing changed</option>
        <option value="daily">Every day</option>
        <option value="weekly">Once a week</option>
      </select>
    </label>
    <div className={styles.inlineNote}>
      <strong>What a scheduled Work Pulse does</strong>
      <p>When the current host supports a verified recurring task, each run refreshes only the sources you have allowed, updates approved project and work context, checks a small relevant-builder shortlist and your saved relevance watch, then posts a concise result in the host surface. It does not send introductions beyond your acceptance mode or weekly limit.</p>
    </div>
    <div className={styles.modelNote}><strong>Model choice</strong><p>The host controls which model runs a scheduled task. Buildmates records your reviewed cadence and never treats a preference as proof that a background task exists.</p></div>
  </div>;
}
