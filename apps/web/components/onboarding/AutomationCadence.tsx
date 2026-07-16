import type { AutomationCadence as Cadence } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

export function AutomationCadence({ value, onChange }: { value: Cadence; onChange: (value: Cadence) => void }) {
  return <div className={styles.stack}>
    <label>Buildmates automation cadence<select value={value} onChange={(event) => onChange(event.target.value as Cadence)}><option value="automatic">Automatic daily check (quiet when nothing changed)</option><option value="daily">Daily</option><option value="twice_weekly">A few times per week</option><option value="weekly">Weekly</option><option value="manual">Manual only</option></select></label>
    <div className={styles.modelNote}><strong>Model recommendation</strong><p>Luna High for routine runs. Luna Extra High for the initial profile or complex generative design. Buildmates recommends these settings; Codex controls the model actually used.</p></div>
  </div>;
}
