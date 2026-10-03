import styles from "../../app/onboarding/onboarding.module.css";

export type ContextDraft = { method: string; summary: string; projectOrInterest: string; links: string };
export function SparseContextInput({ value, onChange }: { value: ContextDraft; onChange: (value: ContextDraft) => void }) {
  return (
    <div className={styles.stack}>
      <div className={styles.inlineNote}>
        <strong>Use only context you approve</strong>
        <p>Your AI host may review only the tasks, projects, links, or context you name and approve. Buildmates receives only the profile details you review.</p>
      </div>
      <label>Choose a context method
        <select value={value.method} onChange={(event) => onChange({ ...value, method: event.target.value })}>
          <option value="manual_profile">Answer focused profile questions</option>
          <option value="repository">Use one repository</option>
          <option value="project">Use one project</option>
          <option value="pasted_description">Use a short pasted description</option>
          <option value="portfolio_links">Use portfolio links</option>
          <option value="connected_context">Use approved connected context</option>
        </select>
      </label>
      <label>What are you building or exploring now?
        <input value={value.projectOrInterest} onChange={(event) => onChange({ ...value, projectOrInterest: event.target.value })} maxLength={240} placeholder="A local-first research assistant for small teams" />
      </label>
      <label>What should another builder understand about you?
        <textarea value={value.summary} onChange={(event) => onChange({ ...value, summary: event.target.value })} minLength={20} maxLength={12000} rows={8} placeholder="Share the work, projects, interests, ambitions, or communities that should shape your profile." />
      </label>
      <label>Portfolio, GitHub, LinkedIn, or project links <span className={styles.optional}>Optional, one HTTPS link per line</span>
        <textarea value={value.links} onChange={(event) => onChange({ ...value, links: event.target.value })} rows={3} placeholder="https://github.com/you/project" />
      </label>
      <p className={styles.inlineNote}>A few details are enough for a manual start. You can add context or redesign your page later.</p>
    </div>
  );
}
