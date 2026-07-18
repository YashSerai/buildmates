"use client";
import { useState, useSyncExternalStore } from "react";
import type {
  OnboardingSnapshot,
  AutomationCadence as Cadence,
} from "@/src/platform/onboarding-data";
import { AutomationCadence } from "@/components/onboarding/AutomationCadence";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "../settings.module.css";
class RequestError extends Error {}
const automationPrompt = "Open Buildmates and create or update my single Buildmates Work Pulse. Use Tuesdays and Fridays unless I have chosen another saved cadence. On each run, refresh only my approved sources and profile context, update approved projects or work signals, check my relevance watch and bounded candidate shortlist, and post a concise outcome here. Keep my quiet hours, introduction limit, and acceptance mode in force. Confirm the schedule before creating it, then tell me the next run and whether any approved source needs my computer to be available.";
export function AutomationClient({
  initialSnapshot,
}: {
  initialSnapshot: OnboardingSnapshot;
}) {
  const pulse = initialSnapshot.networking;
  const [cadence, setCadence] = useState<Cadence>(
    initialSnapshot.automation?.cadence ?? "twice_weekly",
  );
  const [form, setForm] = useState({
    intentSummary:
      pulse?.intentSummary ??
      "Meet builders whose work overlaps with or complements mine",
    builderSimilarity: pulse?.controls.builderSimilarity ?? "balanced",
    geography: pulse?.controls.geography ?? "balanced",
    maximumIntroductionsPerWeek:
      pulse?.controls.maximumIntroductionsPerWeek ?? 3,
    serendipity: pulse?.serendipity ?? 25,
    timezone:
      pulse?.controls.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    quietStart: pulse?.controls.quietStart ?? "22:00",
    quietEnd: pulse?.controls.quietEnd ?? "08:00",
    exclusions: pulse?.controls.exclusions.join("\n") ?? "",
    snoozedUntil: pulse?.controls.snoozedUntil?.slice(0,16) ?? "",
    avoidRepeatedClusters: pulse?.controls.avoidRepeatedClusters ?? true,
    expiresAt:
      pulse && !pulse.expired
        ? pulse.expiresAt.slice(0, 10)
        : new Date(Date.parse(initialSnapshot.generatedAt) + 30 * 864e5)
            .toISOString()
            .slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [liveness, setLiveness] = useState(
    initialSnapshot.automation?.sourceLivenessReviewed ?? false,
  );
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new RequestError(userFacingError(payload.error, "Could not save settings."));
      setMessage(body.action === "save_automation" ? "Work Pulse preferences saved. The recurring task is not confirmed yet. Continue in Codex to create or update it." : "Networking Pulse saved.");
    } catch (error) {
      setMessage(
        error instanceof RequestError ? error.message : "Could not save settings. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyAutomationPrompt() {
    try {
      await navigator.clipboard.writeText(automationPrompt);
      setMessage("Automation prompt copied. Paste it into Codex.");
    } catch {
      setMessage("Copy was blocked. Open Buildmates in Codex and ask it to create your Work Pulse from the saved preferences.");
    }
  }
  return (
    <div className={styles.singleColumn} data-hydrated={hydrated} aria-busy={!hydrated || busy}>
      <section>
        <header className={styles.sectionHeader}>
          <div>
            <h2>Networking Pulse</h2>
            <p>
              Your temporary brief for who Buildmates should consider. It expires so an old goal does not quietly become a permanent preference.
            </p>
          </div>
          {pulse?.expired ? (
            <span className={styles.warning}>Expired</span>
          ) : null}
        </header>
        <div className={styles.formGrid}>
          <label className={styles.full}>
            Current intent
            <input
              value={form.intentSummary}
              onChange={(e) =>
                setForm({ ...form, intentSummary: e.target.value })
              }
            />
          </label>
          <label>
            Builder mix
            <span>Similar favors shared work; adjacent favors complementary work; balanced uses both.</span>
            <select
              value={form.builderSimilarity}
              onChange={(e) =>
                setForm({
                  ...form,
                  builderSimilarity: e.target.value as "similar" | "adjacent" | "balanced",
                })
              }
            >
              <option value="similar">Similar</option>
              <option value="balanced">Balanced</option>
              <option value="adjacent">Adjacent</option>
            </select>
          </label>
          <label>
            Geography
            <span>Local first prioritizes nearby builders, global first removes that preference, and balanced considers both.</span>
            <select
              value={form.geography}
              onChange={(e) =>
                setForm({
                  ...form,
                  geography: e.target.value as "local" | "global" | "balanced",
                })
              }
            >
              <option value="local">Local first</option>
              <option value="balanced">Balanced</option>
              <option value="global">Global first</option>
            </select>
          </label>
          <label>
            Introductions per week
            <span>A hard cap on new introductions. Existing conversations are unaffected.</span>
            <input
              type="number"
              min="0"
              max="20"
              value={form.maximumIntroductionsPerWeek}
              onChange={(e) =>
                setForm({
                  ...form,
                  maximumIntroductionsPerWeek: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Serendipity: {form.serendipity}%
            <span>How often to include a thoughtful stretch beyond your closest overlap.</span>
            <input
              type="range"
              min="0"
              max="100"
              value={form.serendipity}
              onChange={(e) =>
                setForm({ ...form, serendipity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Quiet start
            <span>Buildmates will not surface scheduled Work Pulse results during these local hours.</span>
            <input
              type="time"
              value={form.quietStart}
              onChange={(e) => setForm({ ...form, quietStart: e.target.value })}
            />
          </label>
          <label>
            Quiet end
            <input
              type="time"
              value={form.quietEnd}
              onChange={(e) => setForm({ ...form, quietEnd: e.target.value })}
            />
          </label>
          <label>
            Networking Pulse expires
            <span>On this date, Codex will ask whether this intent still fits. Your profile stays published.</span>
            <input
              type="date"
              min={new Date(Date.parse(initialSnapshot.generatedAt) + 864e5)
                .toISOString()
                .slice(0, 10)}
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </label>
          <label className={styles.full}>
            Snooze matching until <span>Optional</span>
            <input type="datetime-local" value={form.snoozedUntil} onChange={(e)=>setForm({...form,snoozedUntil:e.target.value})} />
          </label>
          <label className={`${styles.full} ${styles.checkLabel}`}>
            <input
              type="checkbox"
              checked={form.avoidRepeatedClusters}
              onChange={(e) =>
                setForm({ ...form, avoidRepeatedClusters: e.target.checked })
              }
            />
            Avoid repeated introductions from the same group
          </label>
          <label className={styles.full}>
            Exclusions <span>Optional</span>
            <span>One person, company, industry, topic, or project category per line. Buildmates leaves these out of candidate suggestions.</span>
            <textarea
              rows={4}
              value={form.exclusions}
              onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
            />
          </label>
        </div>
        <button
          onClick={() =>
            save({
              action: "save_networking",
              ...form,
              similarAdjacent:
                form.builderSimilarity === "similar"
                  ? 20
                  : form.builderSimilarity === "adjacent"
                    ? 80
                    : 50,
              localGlobal:
                form.geography === "local"
                  ? 20
                  : form.geography === "global"
                    ? 80
                    : 50,
              exclusions: form.exclusions
                .split(/\r?\n/)
                .map((v) => v.trim())
                .filter(Boolean),
              expiresAt: new Date(
                `${form.expiresAt}T23:59:59.000Z`,
              ).toISOString(),
              snoozedUntil: form.snoozedUntil ? new Date(form.snoozedUntil).toISOString() : null,
            })
          }
          disabled={busy}
        >
          Save Networking Pulse
        </button>
      </section>
      <section>
        <header className={styles.sectionHeader}>
          <div>
            <h2>Your Buildmates Work Pulse</h2>
            <p>
              Recommended: Tuesdays and Fridays. Saving here records your preferences only. Continue in Codex to confirm the recurring Work Pulse that posts its outcome back to you.
            </p>
          </div>
          <span
            className={styles.badge}
            data-status={
              initialSnapshot.automation?.capability === "available"
                ? "available"
                : "stale"
            }
          >
            {automationStatusLabel(initialSnapshot.automation?.capability)}
          </span>
        </header>
        <AutomationCadence value={cadence} onChange={setCadence} />
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={liveness}
            onChange={(e) => setLiveness(e.target.checked)}
          />
          I understand local or device-bound sources refresh only while Codex desktop and this computer are available.
        </label>
        <div className={styles.actionRow}>
          <button
            onClick={() =>
              save({
                action: "save_automation",
                cadence,
                enabled: cadence !== "manual",
                sourceLivenessReviewed: liveness,
              })
            }
            disabled={busy}
          >
            Save Work Pulse preferences
          </button>
          <a className={styles.primaryLink} href={`codex://open?prompt=${encodeURIComponent(automationPrompt)}`}>Continue in Codex</a>
          <button className={styles.secondaryButton} type="button" onClick={() => void copyAutomationPrompt()}>Copy prompt</button>
          {initialSnapshot.codexConnected ? (
            <button className={styles.secondaryButton} onClick={()=>save({action:"save_automation",cadence,enabled:cadence!=="manual",sourceLivenessReviewed:liveness,requestCapabilityRecheck:true})} disabled={busy || !liveness}>
              Recheck background actions
            </button>
          ) : null}
        </div>
      </section>
      <p className={styles.liveMessage} role="status" aria-live="polite">
        {busy ? "Saving…" : message}
      </p>
    </div>
  );
}

function emptySubscribe() {
  return () => undefined;
}

function automationStatusLabel(value?: string) {
  return ({
    available: "Background runs ready",
    approval_required: "Confirmation needed",
    automation_unavailable: "Background runs unavailable",
  } as Record<string, string>)[value ?? ""] ?? "Not checked yet";
}
