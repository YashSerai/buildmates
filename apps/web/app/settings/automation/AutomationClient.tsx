"use client";
import { useState, useSyncExternalStore } from "react";
import type {
  OnboardingSnapshot,
  AutomationCadence as Cadence,
} from "@/src/platform/onboarding-data";
import { AutomationCadence } from "@/components/onboarding/AutomationCadence";
import styles from "../settings.module.css";
export function AutomationClient({
  initialSnapshot,
}: {
  initialSnapshot: OnboardingSnapshot;
}) {
  const pulse = initialSnapshot.networking;
  const [cadence, setCadence] = useState<Cadence>(
    initialSnapshot.automation?.cadence ?? "automatic",
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
        : new Date(Date.parse(initialSnapshot.generatedAt) + 28 * 864e5)
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
        throw new Error(payload.error || "Could not save settings.");
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.singleColumn} data-hydrated={hydrated} aria-busy={!hydrated || busy}>
      <section>
        <header className={styles.sectionHeader}>
          <div>
            <h2>Networking Pulse</h2>
            <p>
              Temporary intent is reconfirmed instead of quietly becoming a
              permanent preference.
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
            Reconfirm on
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
            Exclude specific builder IDs, one per line
            <textarea
              rows={3}
              value={form.exclusions}
              onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
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
            Avoid repeated matches from the same cluster
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
            <h2>One Buildmates automation</h2>
            <p>
              Automatic checks no-op quietly when nothing relevant changed. Host
              usage limits still apply.
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
            {initialSnapshot.automation?.capability.replaceAll("_", " ") ??
              "not checked"}
          </span>
        </header>
        <AutomationCadence value={cadence} onChange={setCadence} />
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={liveness}
            onChange={(e) => setLiveness(e.target.checked)}
          />
          I understand local/device sources need Codex desktop and the computer
          to be available.
        </label>
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
          Save automation
        </button>
        {initialSnapshot.codexConnected ? (
          <button className={styles.secondaryButton} onClick={()=>save({action:"save_automation",cadence,enabled:cadence!=="manual",sourceLivenessReviewed:liveness,requestCapabilityRecheck:true})} disabled={busy || !liveness}>
            Request unattended-write recheck
          </button>
        ) : null}
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
