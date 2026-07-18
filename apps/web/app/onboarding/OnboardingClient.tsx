"use client";
import { useState, useSyncExternalStore } from "react";
import type {
  OnboardingSnapshot,
  SourcePolicy,
  AcceptanceMode as Mode,
  AutomationCadence as Cadence,
  Audience,
} from "@/src/platform/onboarding-data";
import { SetupProgress } from "@/components/onboarding/SetupProgress";
import {
  SparseContextInput,
  type ContextDraft,
} from "@/components/onboarding/SparseContextInput";
import {
  AppPermissionRow,
  type SourceDraft,
} from "@/components/onboarding/AppPermissionRow";
import { WorkSignalReview } from "@/components/onboarding/WorkSignalReview";
import { AcceptanceMode } from "@/components/onboarding/AcceptanceMode";
import { AutomationCadence } from "@/components/onboarding/AutomationCadence";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./onboarding.module.css";

class RequestError extends Error {}

export function OnboardingClient({
  initialSnapshot,
  defaultDisplayName,
}: {
  initialSnapshot: OnboardingSnapshot;
  defaultDisplayName: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<SourceDraft[]>(
    initialSnapshot.sources.map(
      ({ appId, displayName, category, accessMode }) => ({
        appId,
        displayName,
        category,
        accessMode,
      }),
    ),
  );
  const [context, setContext] = useState<ContextDraft>({
    method: initialSnapshot.sources.some(
      (source) => source.accessMode === "allow_approved_work_signals",
    )
      ? "connected_context"
      : "manual_profile",
    summary: initialSnapshot.profile?.summary ?? "",
    projectOrInterest: initialSnapshot.profile?.projectOrInterest ?? "",
    links: initialSnapshot.profile?.portfolioLinks.join("\n") ?? "",
  });
  const [mode, setMode] = useState<Mode>(
    initialSnapshot.profile?.acceptanceMode ?? "manual",
  );
  const [cadence, setCadence] = useState<Cadence>(
    initialSnapshot.automation?.cadence ?? "twice_weekly",
  );
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  async function onboarding(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as
        OnboardingSnapshot | { error: string };
      if (!response.ok)
        throw new RequestError(
          userFacingError(
            "error" in payload ? payload.error : undefined,
            "Could not save this step.",
          ),
        );
      setSnapshot(payload as OnboardingSnapshot);
      setMessage("Saved. Your setup progress is up to date.");
    } catch (error) {
      setMessage(
        error instanceof RequestError
          ? error.message
          : "Could not save this step. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveSources() {
    setBusy(true);
    setMessage("");
    try {
      const clean = sources.map((source, index) => ({
        ...source,
        appId: source.appId || `named-source-${index + 1}`,
      }));
      const response = await fetch("/api/connected-apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sources: clean, completeStep: true }),
      });
      const payload = (await response.json()) as {
        sources?: OnboardingSnapshot["sources"];
        error?: string;
      };
      if (!response.ok)
        throw new RequestError(
          userFacingError(payload.error, "Could not save source policies."),
        );
      const refreshed = await fetch("/api/onboarding", { cache: "no-store" });
      setSnapshot((await refreshed.json()) as OnboardingSnapshot);
      setMessage(
        clean.length
          ? "Source policies saved."
          : "Continuing without connected sources.",
      );
    } catch (error) {
      setMessage(
        error instanceof RequestError
          ? error.message
          : "Could not save source policies. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signalMutation(
    signal: OnboardingSnapshot["signals"][number],
    action = "update",
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/work-signals", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...signal, action }),
      });
      const payload = (await response.json()) as {
        signals?: OnboardingSnapshot["signals"];
        error?: string;
      };
      if (!response.ok)
        throw new RequestError(
          userFacingError(payload.error, "Could not update the signal."),
        );
      setSnapshot((current) => ({
        ...current,
        signals: payload.signals ?? current.signals,
      }));
      setMessage(
        action === "reject"
          ? "Signal removed from Buildmates."
          : "Signal saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof RequestError
          ? error.message
          : "Could not update the signal. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const step = snapshot.setup.nextStep;
  return (
    <div
      className={styles.workspace}
      data-hydrated={hydrated}
      aria-busy={!hydrated || busy}
    >
      <SetupProgress
        completedSteps={snapshot.setup.completedSteps}
        nextStep={step}
      />
      <section className={styles.stepPanel} aria-labelledby="step-title">
        <div className={styles.resumeLine}>
          <span>
            {snapshot.setup.complete
              ? "Codex setup complete"
              : step === "identity_link"
                ? "Website preparation saved"
                : "Current step"}
          </span>
          <span>
            {snapshot.codexConnected
              ? "Codex connected"
              : "Codex connection pending"}
          </span>
        </div>
        {step === "identity_link" && (
          <Step
            title="Connect Buildmates in Codex"
            description="Your website account is ready. The guided first run begins after Codex confirms the secure account link."
          >
            <div className={styles.completion}>
              <strong>Connection required</strong>
              <p>
                Generate a single-use linking code, then complete the Buildmates
                connection from Codex. This website cannot mark the connection
                complete on its own.
              </p>
              <a href="/settings/connections">Open Codex connection settings</a>
            </div>
          </Step>
        )}
        {step === "storage_explanation" && (
          <Step title="You choose what Buildmates learns">
            <div className={styles.boundaryGrid}>
              <div>
                <strong>Codex may read</strong>
                <p>Only the connected apps and information you allow.</p>
              </div>
              <div>
                <strong>Buildmates stores</strong>
                <p>The short summaries and profile details you approve.</p>
              </div>
              <div>
                <strong>Buildmates never receives</strong>
                <p>
                  Passwords, raw chats, full prompts, complete documents, email
                  bodies, or private repository contents.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                onboarding({
                  action: "acknowledge_storage",
                  acknowledged: true,
                })
              }
              disabled={busy}
            >
              I understand the boundary
            </button>
          </Step>
        )}
        {step === "source_selection" && (
          <Step
            title="Choose each source individually"
            description="Codex shows the connected sources it can identify in this conversation. You can also name a source yourself."
          >
            <div className={styles.stack}>
              {sources.map((source, index) => (
                <AppPermissionRow
                  key={`${source.appId}-${index}`}
                  source={source}
                  onChange={(next) =>
                    setSources((all) =>
                      all.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    setSources((all) =>
                      all.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                />
              ))}
            </div>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  setSources((all) => [
                    ...all,
                    {
                      appId: `source-${all.length + 1}`,
                      displayName: "",
                      category: "Projects and code",
                      accessMode: "ask_each_time" as SourcePolicy,
                    },
                  ])
                }
              >
                Add a named source
              </button>
              <button onClick={saveSources} disabled={busy}>
                {sources.length
                  ? "Save policies and continue"
                  : "Continue without connected sources"}
              </button>
            </div>
            <p className={styles.inlineNote}>
              Your connected apps keep their existing permissions.
            </p>
          </Step>
        )}
        {step === "context_collection" && (
          <Step
            title={
              snapshot.sources.length
                ? "Fill the gaps Codex could not confirm"
                : "Start with what you know"
            }
            description="A basic profile is useful even when connected context is sparse."
          >
            <SparseContextInput value={context} onChange={setContext} />
            <button
              onClick={() =>
                onboarding({
                  action: "save_context",
                  ...context,
                  links: context.links
                    .split(/\r?\n/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              disabled={busy}
            >
              Save builder context
            </button>
          </Step>
        )}
        {step === "signal_privacy_review" && (
          <Step
            title="Review every Work Signal"
            description="Generated suggestions are not confirmed facts until you keep them. Each signal has separate visibility and matching controls."
          >
            <WorkSignalReview
              signals={snapshot.signals}
              onSave={(signal) => signalMutation(signal)}
              onReject={(signal) => signalMutation(signal, "reject")}
              busy={busy}
            />
            <button
              onClick={() =>
                onboarding({
                  action: "review_signals",
                  signalIds: snapshot.signals
                    .filter((signal) => signal.status !== "revoked")
                    .map((signal) => signal.id),
                })
              }
              disabled={busy}
            >
              Finish privacy review
            </button>
          </Step>
        )}
        {step === "basic_profile" && (
          <ProfileStep
            profile={snapshot.profile}
            defaultDisplayName={defaultDisplayName}
            busy={busy}
            onSubmit={onboarding}
          />
        )}
        {step === "page_preview" && (
          <Step
            title="Preview your profile"
            description="Only you can see this version. Keep shaping it until it feels like you, then publish when you are ready."
          >
            <article className={styles.profilePreview}>
              <span>@{snapshot.profile?.handle ?? "builder"}</span>
              <h2>{snapshot.profile?.displayName}</h2>
              <p>{snapshot.profile?.summary}</p>
              <strong>Currently</strong>
              <p>{snapshot.profile?.projectOrInterest}</p>
            </article>
            <button
              onClick={() =>
                onboarding({ action: "approve_preview", approved: true })
              }
              disabled={busy}
            >
              Continue with this profile
            </button>
          </Step>
        )}
        {step === "networking_pulse" && (
          <NetworkingStep
            initial={snapshot.networking}
            generatedAt={snapshot.generatedAt}
            busy={busy}
            onSubmit={onboarding}
          />
        )}
        {step === "acceptance_mode" && (
          <Step
            title="Choose your acceptance mode"
            description="Review introductions yourself, or let Full Autopilot accept strong matches using the preferences you set."
          >
            <AcceptanceMode value={mode} onChange={setMode} />
            <button
              onClick={() => onboarding({ action: "save_acceptance", mode })}
              disabled={busy}
            >
              Save acceptance mode
            </button>
          </Step>
        )}
        {step === "automation" && (
          <Step
            title="Set up your Work Pulse"
            description="Recommended: Tuesdays and Fridays. On each scheduled run, Codex refreshes only approved sources, keeps your profile context current, checks a small relevant-builder shortlist and your relevance watch, then posts a concise update here."
          >
            <AutomationCadence value={cadence} onChange={setCadence} />
            <label className={styles.checkLabel}>
              <input id="liveness" type="checkbox" /> I understand that local
              repositories and device-bound sources refresh only when my
              computer and Codex desktop are available.
            </label>
            <button
              onClick={() => {
                const checkbox =
                  document.querySelector<HTMLInputElement>("#liveness");
                void onboarding({
                  action: "save_automation",
                  cadence,
                  enabled: cadence !== "manual",
                  sourceLivenessReviewed: checkbox?.checked === true,
                });
              }}
              disabled={busy}
            >
              Save automation
            </button>
          </Step>
        )}
        {!step && (
          <CompletionStep handle={snapshot.profile?.handle} />
        )}
        <p className={styles.liveMessage} role="status" aria-live="polite">
          {busy ? "Saving…" : message}
        </p>
      </section>
    </div>
  );
}

function Step({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.stepContent}>
      <p className={styles.eyebrow}>Setup</p>
      <h2 id="step-title">{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
    </div>
  );
}
function ProfileStep({
  profile,
  defaultDisplayName,
  busy,
  onSubmit,
}: {
  profile: OnboardingSnapshot["profile"];
  defaultDisplayName: string;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    handle: profile?.handle ?? "",
    displayName: profile?.displayName ?? defaultDisplayName,
    summary: profile?.summary ?? "",
    projectOrInterest: profile?.projectOrInterest ?? "",
    audience: profile?.audience ?? "private",
    allowMatching: profile?.allowMatching ?? true,
  });
  return (
    <Step
      title="Confirm your basic builder profile"
      description="Generated suggestions and user-confirmed fields stay visibly separate. This step saves only what you review here."
    >
      <div className={styles.stack}>
        <label>
          Handle
          <input
            value={form.handle}
            onChange={(event) =>
              setForm({ ...form, handle: event.target.value.toLowerCase() })
            }
            placeholder="your_name"
            pattern="[a-z0-9_]{3,32}"
          />
        </label>
        <label>
          Display name
          <input
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
          />
        </label>
        <label>
          Builder description
          <textarea
            rows={5}
            value={form.summary}
            onChange={(event) =>
              setForm({ ...form, summary: event.target.value })
            }
          />
        </label>
        <label>
          Current project or interest
          <input
            value={form.projectOrInterest}
            onChange={(event) =>
              setForm({ ...form, projectOrInterest: event.target.value })
            }
          />
        </label>
        <label>
          Profile visibility
          <select
            value={form.audience}
            onChange={(event) =>
              setForm({ ...form, audience: event.target.value as Audience })
            }
          >
            <option value="private">Private</option>
            <option value="suggested_connections">Suggested connections</option>
            <option value="signed_in">Signed-in builders</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.allowMatching}
            onChange={(event) =>
              setForm({ ...form, allowMatching: event.target.checked })
            }
          />{" "}
          Use confirmed profile fields for matching
        </label>
      </div>
      <button
        onClick={() => onSubmit({ action: "save_profile", ...form })}
        disabled={busy}
      >
        Confirm profile
      </button>
    </Step>
  );
}
function NetworkingStep({
  initial,
  generatedAt,
  busy,
  onSubmit,
}: {
  initial: OnboardingSnapshot["networking"];
  generatedAt: string;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    intentSummary:
      initial?.intentSummary ??
      "Meet builders with overlapping or adjacent work",
    similarAdjacent: initial?.similarAdjacent ?? 50,
    localGlobal: initial?.localGlobal ?? 50,
    serendipity: initial?.serendipity ?? 25,
    maximumIntroductionsPerWeek:
      initial?.controls.maximumIntroductionsPerWeek ?? 3,
    builderSimilarity: initial?.controls.builderSimilarity ?? "balanced",
    geography: initial?.controls.geography ?? "balanced",
    timezone:
      initial?.controls.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    quietStart: initial?.controls.quietStart ?? "22:00",
    quietEnd: initial?.controls.quietEnd ?? "08:00",
    exclusions: initial?.controls.exclusions.join("\n") ?? "",
    snoozedUntil: initial?.controls.snoozedUntil?.slice(0, 16) ?? "",
    avoidRepeatedClusters: initial?.controls.avoidRepeatedClusters ?? true,
    expiresAt:
      initial?.expiresAt ??
      new Date(Date.parse(generatedAt) + 30 * 864e5).toISOString().slice(0, 10),
  });
  return (
    <Step
      title="Set a temporary Networking Pulse"
      description="Intent expires so old goals do not quietly control future introductions."
    >
      <div className={styles.stack}>
        <label>
          Current networking intent
          <input
            value={form.intentSummary}
            onChange={(event) =>
              setForm({ ...form, intentSummary: event.target.value })
            }
          />
        </label>
        <div className={styles.twoColumns}>
          <label>
            Builder mix
            <span>Similar favors closely related work. Adjacent favors complementary work. Balanced uses both.</span>
            <select
              value={form.builderSimilarity}
              onChange={(event) =>
                setForm({
                  ...form,
                  builderSimilarity: event.target.value as
                    "similar" | "adjacent" | "balanced",
                })
              }
            >
              <option value="similar">More similar</option>
              <option value="balanced">Balanced</option>
              <option value="adjacent">More adjacent</option>
            </select>
          </label>
          <label>
            Geography
            <span>Choose whether nearby builders, builders anywhere, or both should be considered.</span>
            <select
              value={form.geography}
              onChange={(event) =>
                setForm({
                  ...form,
                  geography: event.target.value as
                    "local" | "global" | "balanced",
                })
              }
            >
              <option value="local">Local first</option>
              <option value="balanced">Balanced</option>
              <option value="global">Global first</option>
            </select>
          </label>
        </div>
        <div className={styles.rangeGrid}>
          <label>
            Serendipity <output>{form.serendipity}%</output>
            <span>How much room to leave for thoughtful matches beyond the most obvious overlap.</span>
            <input
              type="range"
              min="0"
              max="100"
              value={form.serendipity}
              onChange={(event) =>
                setForm({ ...form, serendipity: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Introductions per week
            <span>A hard cap on new introductions, not a target Buildmates must fill.</span>
            <input
              type="number"
              min="0"
              max="20"
              value={form.maximumIntroductionsPerWeek}
              onChange={(event) =>
                setForm({
                  ...form,
                  maximumIntroductionsPerWeek: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
        <div className={styles.twoColumns}>
          <label>
            Quiet hours start
            <span>Scheduled introduction activity stays quiet during these local hours.</span>
            <input
              type="time"
              value={form.quietStart}
              onChange={(event) =>
                setForm({ ...form, quietStart: event.target.value })
              }
            />
          </label>
          <label>
            Quiet hours end
            <input
              type="time"
              value={form.quietEnd}
              onChange={(event) =>
                setForm({ ...form, quietEnd: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Reconfirm on
          <span>Codex will ask whether this temporary intent still fits. Your profile is not deleted.</span>
          <input
            type="date"
            value={form.expiresAt.slice(0, 10)}
            min={new Date(Date.parse(generatedAt) + 864e5)
              .toISOString()
              .slice(0, 10)}
            onChange={(event) =>
              setForm({ ...form, expiresAt: event.target.value })
            }
          />
        </label>
        <label>
          Snooze matching until{" "}
          <span className={styles.optional}>Optional</span>
          <input
            type="datetime-local"
            value={form.snoozedUntil}
            onChange={(event) =>
              setForm({ ...form, snoozedUntil: event.target.value })
            }
          />
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.avoidRepeatedClusters}
            onChange={(event) =>
              setForm({ ...form, avoidRepeatedClusters: event.target.checked })
            }
          />{" "}
          Avoid repeated introductions from the same narrow cluster
        </label>
        <label>
          Exclusions <span className={styles.optional}>Optional</span>
          <span>One person, company, industry, topic, or project category per line.</span>
          <textarea
            rows={4}
            value={form.exclusions}
            onChange={(event) =>
              setForm({ ...form, exclusions: event.target.value })
            }
          />
        </label>
      </div>
      <button
        onClick={() =>
          onSubmit({
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
              .map((item) => item.trim())
              .filter(Boolean),
            expiresAt: new Date(
              `${form.expiresAt.slice(0, 10)}T23:59:59.000Z`,
            ).toISOString(),
            snoozedUntil: form.snoozedUntil
              ? new Date(form.snoozedUntil).toISOString()
              : null,
          })
        }
        disabled={busy}
      >
        Save Networking Pulse
      </button>
    </Step>
  );
}
function CompletionStep({ handle }: { handle?: string | null }) {
  return (
    <Step
      title="Your Buildmates profile is ready"
      description="Your profile is published, and your Work Pulse will keep its approved context and networking intent current. Return to Codex any time you want to redesign your page or change how Buildmates represents your work."
    >
      <div className={styles.completion}>
        <strong>Choose where to go next</strong>
        {handle ? <a href={`/builders/${handle}`}>View your public profile</a> : null}
        <a href="/profile/edit">Edit your profile details</a>
        <a href="/profile/design">Redesign your page with Codex</a>
        <a href="/settings/automation">Review your Tuesday and Friday Work Pulse</a>
        <a href="/invite">Create a personal link to invite builders you know</a>
      </div>
    </Step>
  );
}

function emptySubscribe() {
  return () => undefined;
}
