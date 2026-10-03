import type { AcceptanceMode as Mode } from "@/src/platform/onboarding-data";
import styles from "../../app/onboarding/onboarding.module.css";

export function AcceptanceMode({ value, onChange }: { value: Mode; onChange: (value: Mode) => void }) {
  return <fieldset className={styles.choiceGroup}><legend>How should Buildmates handle a reciprocal match?</legend>
    <label className={value === "manual" ? styles.selectedChoice : ""}><input type="radio" name="acceptance" value="manual" checked={value === "manual"} onChange={() => onChange("manual")} /><span><strong>Manual</strong><small>Both sides can review the match, then you decide whether to show interest.</small></span></label>
    <label className={value === "full_autopilot" ? styles.selectedChoice : ""}><input type="radio" name="acceptance" value="full_autopilot" checked={value === "full_autopilot"} onChange={() => onChange("full_autopilot")} /><span><strong>Full Autopilot</strong><small>Your connected host may accept for you only after it confirms background actions work. The other person follows their own setting.</small></span></label>
  </fieldset>;
}
