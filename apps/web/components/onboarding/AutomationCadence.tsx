import type { AutomationCadence as Cadence } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

export function AutomationCadence({ value, onChange }: { value: Cadence; onChange: (value: Cadence) => void }) {
  return <div className={styles.stack}>
    <label>When should Work Pulse run?<select value={value} onChange={(event) => onChange(event.target.value as Cadence)}><option value="twice_weekly">Tuesdays and Fridays - recommended</option><option value="automatic">Daily check - quiet when nothing changed</option><option value="daily">Every day</option><option value="weekly">Once a week</option><option value="manual">Only when I ask Codex</option></select></label>
    <div className={styles.inlineNote}>
      <strong>What a scheduled Work Pulse does</strong>
      <p>On each run, Codex refreshes only the sources you have allowed, updates approved project and work context, checks a small relevant-builder shortlist and your saved relevance watch, then posts a concise result in your Codex task. It does not send introductions beyond your acceptance mode or weekly limit.</p>
    </div>
    <div className={styles.modelNote}><strong>Model recommendation</strong><p>Use GPT-5.6 Luna High for setup and routine runs when it is available. Buildmates recommends this setting; Codex controls the model actually used.</p></div>
  </div>;
}
