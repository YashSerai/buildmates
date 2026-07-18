"use client";
import { useState, useSyncExternalStore } from "react";
import type { OnboardingSnapshot } from "@/src/platform/onboarding-data";
import { userFacingError } from "@/src/client/user-facing-error";
import { useConfirmDialog } from "@/components/discovery/ConfirmDialog";
import styles from "../settings.module.css";

class RequestError extends Error {}

export function PrivacyClient({
  initialSnapshot,
}: {
  initialSnapshot: OnboardingSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pauseUntil, setPauseUntil] = useState(
    new Date(Date.parse(initialSnapshot.generatedAt) + 7 * 864e5)
      .toISOString()
      .slice(0, 10),
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { confirm, confirmationDialog } = useConfirmDialog();
  async function command(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        snapshot?: OnboardingSnapshot;
        error?: string;
        jobId?: string;
      };
      if (!response.ok)
        throw new RequestError(userFacingError(payload.error, "Could not complete that request."));
      if (body.command === "request_deletion") {
        window.location.assign("/account/deleted");
        return;
      }
      if (payload.snapshot) setSnapshot(payload.snapshot);
      setMessage(payload.jobId ? "Your request is queued." : "Privacy setting updated.");
    } catch (error) {
      setMessage(
        error instanceof RequestError
          ? error.message
          : "Could not complete that request. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revokeSource(appId: string) {
    if (!(await confirm({
      title: "Remove this connected source?",
      description: "Its active Work Signals will also stop contributing to future matching.",
      confirmLabel: "Remove source",
      tone: "danger",
    }))) return;
    setBusy(true);
    try {
      const response = await fetch("/api/connected-apps", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new RequestError(userFacingError(payload.error, "Could not revoke source."));
      await refresh();
      setMessage(
        "Source revoked and its active signals removed from future matching.",
      );
    } catch (error) {
      setMessage(
        error instanceof RequestError ? error.message : "Could not revoke source. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteSignal(id: string) {
    if (!(await confirm({
      title: "Delete this Work Signal?",
      description: "Buildmates will stop using it for matching. This does not delete anything from the original source.",
      confirmLabel: "Delete Work Signal",
      tone: "danger",
    }))) return;
    setBusy(true);
    try {
      const response = await fetch("/api/work-signals", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as {
        signals?: OnboardingSnapshot["signals"];
        error?: string;
      };
      if (!response.ok)
        throw new RequestError(userFacingError(payload.error, "Could not delete the Work Signal."));
      setSnapshot((current) => ({
        ...current,
        signals: payload.signals ?? current.signals,
      }));
      setMessage("Work Signal removed from Buildmates.");
    } catch (error) {
      setMessage(
        error instanceof RequestError ? error.message : "Could not delete the Work Signal. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const response = await fetch("/api/privacy", { cache: "no-store" });
    if (response.ok) setSnapshot((await response.json()) as OnboardingSnapshot);
  }
  return (
    <div className={styles.settingsGrid} data-hydrated={hydrated} aria-busy={!hydrated || busy}>
      {confirmationDialog}
      <aside className={styles.summary}>
        <div>
          <strong>{snapshot.sources.length}</strong>
          <span>source policies</span>
        </div>
        <div>
          <strong>
            {
              snapshot.signals.filter((signal) => signal.status !== "revoked")
                .length
            }
          </strong>
          <span>active signals</span>
        </div>
        <div>
          <strong>
            {snapshot.networking?.expired
              ? "Expired"
              : snapshot.networking
                ? "Current"
                : "None"}
          </strong>
          <span>Networking Pulse</span>
        </div>
        <p>
          Buildmates does not store your connector credentials or raw source
          content.
        </p>
      </aside>
      <div className={styles.sections}>
        <section>
          <SectionHeading
            title="Connected sources"
            description="Your Buildmates source permissions are separate from ChatGPT connector permissions."
            action={<a href="/onboarding">Add or review sources</a>}
          />
          {snapshot.sources.length ? (
            <div className={styles.list}>
              {snapshot.sources.map((source) => (
                <article key={source.id}>
                  <div>
                    <strong>{source.displayName}</strong>
                    <span>
                      {source.category} · {policyLabel(source.accessMode)}
                    </span>
                    {source.latestSignal ? (
                      <p>Latest approved signal: {source.latestSignal}</p>
                    ) : (
                      <p>No active signal from this source.</p>
                    )}
                  </div>
                  <button
                    className={styles.dangerText}
                    onClick={() => revokeSource(source.appId)}
                    disabled={busy}
                  >
                    Revoke
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No active source policies"
              body="You can build a manual profile without connecting another app."
            />
          )}
        </section>
        <section>
          <SectionHeading
            title="Work Signals"
            description="Expired signals stay visible here, but no longer shape introductions."
          />
          {snapshot.signals.filter((signal) => signal.status !== "revoked")
            .length ? (
            <div className={styles.list}>
              {snapshot.signals
                .filter((signal) => signal.status !== "revoked")
                .map((signal) => (
                  <article key={signal.id}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span
                          className={styles.badge}
                          data-status={signal.status}
                        >
                          {statusLabel(signal.status)}
                        </span>
                        <span>
                          {visibilityLabel(signal.audience)} ·{" "}
                          {signal.allowMatching
                            ? "matching allowed"
                            : "excluded from matching"}
                        </span>
                      </div>
                      <strong>{signal.summary}</strong>
                      <p>Source: {signal.sourceDisplayName}</p>
                      <p>
                        Expires{" "}
                        {formatDate(signal.expiresAt)}
                      </p>
                    </div>
                    <button
                      className={styles.dangerText}
                      onClick={() => deleteSignal(signal.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="No active Work Signals"
              body="A Work Pulse can add concise summaries after you approve the source policy."
            />
          )}
        </section>
        <section>
          <SectionHeading
            title="Profile and networking"
            description="Your networking intent expires so an old goal does not quietly keep shaping introductions."
            action={<a href="/settings/automation">Edit networking controls</a>}
          />
          <dl className={styles.details}>
            <div>
              <dt>Profile visibility</dt>
              <dd>
                {snapshot.profile
                  ? visibilityLabel(snapshot.profile.audience)
                  : "No profile"}
              </dd>
            </div>
            <div>
              <dt>Acceptance</dt>
              <dd>
                {snapshot.profile?.acceptanceMode === "full_autopilot"
                  ? "Full Autopilot"
                  : "Manual"}
              </dd>
            </div>
            <div>
              <dt>Current intent</dt>
              <dd>
                {snapshot.networking?.intentSummary ?? "No Networking Pulse"}
              </dd>
            </div>
            <div>
              <dt>Pulse expiry</dt>
              <dd>
                {snapshot.networking
                  ? formatDate(snapshot.networking.expiresAt)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className={styles.controlRow}>
            <label>
              Pause matching until
              <input
                type="date"
                value={pauseUntil}
                min={new Date(Date.parse(snapshot.generatedAt) + 864e5)
                  .toISOString()
                  .slice(0, 10)}
                onChange={(event) => setPauseUntil(event.target.value)}
              />
            </label>
            <button
              onClick={() =>
                void command({
                  command: "pause_matching",
                  until: new Date(`${pauseUntil}T23:59:59.000Z`).toISOString(),
                })
              }
              disabled={busy}
            >
              Pause matching
            </button>
            {snapshot.profile?.acceptanceMode === "full_autopilot" ? (
              <button
                className={styles.secondaryButton}
                onClick={() => command({ command: "disable_autopilot" })}
                disabled={busy}
              >
                Switch to Manual
              </button>
            ) : null}
          </div>
        </section>
        <section>
          <SectionHeading
            title="Work Pulse and Codex"
            description="Disconnecting revokes the Codex identity link, disables source policies, and revokes active Work Signals. Your profile, projects, Connections, rooms, and messages remain until you delete them separately."
          />
          <dl className={styles.details}>
            <div>
              <dt>Codex link</dt>
              <dd>{snapshot.codexConnected ? "Connected" : "Not connected"}</dd>
            </div>
            <div>
              <dt>Automation</dt>
              <dd>
                {snapshot.automation?.enabled
                  ? cadenceLabel(snapshot.automation.cadence)
                  : "Manual only"}
              </dd>
            </div>
            <div>
              <dt>Background actions</dt>
              <dd>
                {capabilityLabel(snapshot.automation?.capability) ??
                  "Not checked"}
              </dd>
            </div>
          </dl>
          <button
            className={styles.dangerButton}
            onClick={async () => {
              if (!(await confirm({
                title: "Disconnect all Codex syncing?",
                description: "Scheduled syncing will stop, and active source signals will no longer contribute to matching.",
                confirmLabel: "Disconnect syncing",
                tone: "danger",
              }))) return;
              void command({ command: "disconnect_all" });
            }}
            disabled={busy}
          >
            Disconnect all syncing
          </button>
        </section>
        <section>
          <SectionHeading
            title="Your other records"
            description="These counts cover only your records. Private notes and another builder's private reasoning are never shown here."
          />
          <dl className={styles.details}>
            <div><dt>Projects</dt><dd>{snapshot.holdings.projects}</dd></div>
            <div><dt>Rooms</dt><dd>{snapshot.holdings.rooms}</dd></div>
            <div><dt>Circles</dt><dd>{snapshot.holdings.circles}</dd></div>
            <div><dt>Recommendations reviewed for me</dt><dd>{snapshot.holdings.evaluations}</dd></div>
            <div><dt>Activity updates</dt><dd>{snapshot.holdings.notifications}</dd></div>
          </dl>
          {snapshot.projects.length ? (
            <div className={styles.list}>
              {snapshot.projects.map((project)=>(
                <article key={project.slug}>
                  <div><strong>{project.title}</strong><span>{statusLabel(project.status)} · {visibilityLabel(project.audience)}</span><p>Updated {formatDate(project.updatedAt)}</p></div>
                  <button className={styles.dangerText} onClick={async ()=>{if(!(await confirm({title:`Delete ${project.title}?`,description:"It will be removed from your profile, shared links, and matching.",confirmLabel:"Delete project",tone:"danger"})))return;void command({command:"delete_project",slug:project.slug})}} disabled={busy}>Delete project</button>
                </article>
              ))}
            </div>
          ) : <Empty title="No active projects" body="Deleted projects no longer appear on your profile, shared links, or matching." />}
          <div className={styles.controlRow}>
            <button
              className={styles.dangerButton}
              onClick={async () => {
                if (!(await confirm({
                  title: "Remove your shared connection context?",
                  description: "Approved facts you contributed will be removed from connection summaries. Messages and another member's private notes will not change.",
                  confirmLabel: "Remove shared context",
                  tone: "danger",
                }))) return;
                void command({ command: "redact_shared_context" });
              }}
              disabled={busy}
            >
              Redact my shared connection context
            </button>
          </div>
        </section>
        <section>
          <SectionHeading
            title="Export and account deletion"
            description="Download a current JSON copy of your Buildmates data. Deletion revokes access immediately, then finishes removing owned assets. It cannot be undone."
          />
          <div className={styles.controlRow}>
            <a href="/api/privacy/export" download>
              Download my data
            </a>
            <label>
              Type DELETE BUILDMATES
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </label>
            <button
              className={styles.dangerButton}
              onClick={() =>
                command({
                  command: "request_deletion",
                  confirmation: deleteConfirmation,
                })
              }
              disabled={busy || deleteConfirmation !== "DELETE BUILDMATES"}
            >
              Delete account
            </button>
          </div>
          {snapshot.lifecycle.length ? (
            <ul className={styles.jobs}>
              {snapshot.lifecycle.map((job) => (
                <li key={job.id}>
                  <span>
                    {lifecycleLabel(job.kind)} · {statusLabel(job.status)}
                  </span>
                  <time dateTime={job.createdAt}>
                    {formatDateTime(job.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section>
          <SectionHeading
            title="Recent privacy activity"
            description="This history records when privacy-sensitive settings changed, without storing the changed content."
          />
          {snapshot.audit.length ? (
            <ul className={styles.audit}>
              {snapshot.audit.map((event) => (
                <li key={event.id}>
                  <span>{auditLabel(event.action)}</span>
                  <time dateTime={event.createdAt}>
                    {formatDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="No account events yet"
              body="Privacy-sensitive changes will appear here."
            />
          )}
        </section>
        <p className={styles.liveMessage} role="status" aria-live="polite">
          {busy ? "Working…" : message}
        </p>
      </div>
    </div>
  );
}
function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.sectionHeader}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
function policyLabel(value: string) {
  return (
    (
      {
        never: "Never use",
        ask_each_time: "Ask each time",
        allow_approved_work_signals: "Allow approved Work Signals",
        actions_only: "Actions only",
      } as Record<string, string>
    )[value] ?? value
  );
}
function visibilityLabel(value: string) {
  return (
    (
      {
        public: "Public",
        signed_in: "Signed-in builders",
        suggested_connections: "Suggested connections",
        mutual_connections: "Mutual connections",
        private: "Private",
      } as Record<string, string>
    )[value] ?? value
  );
}

function statusLabel(value:string){return ({active:"Active",expired:"Expired",pending:"Pending",processing:"In progress",complete:"Complete",completed:"Complete",failed:"Needs attention",revoked:"Revoked",draft:"Draft",published:"Published",paused:"Paused"} as Record<string,string>)[value]??"Updated"}
function cadenceLabel(value:string){return ({automatic:"Daily check",daily:"Daily",twice_weekly:"Tuesdays and Fridays",weekly:"Weekly",manual:"Manual only"} as Record<string,string>)[value]??"Scheduled"}
function capabilityLabel(value?:string){if(!value)return undefined;return ({available:"Background actions ready",approval_required:"Needs confirmation",automation_unavailable:"Not available"} as Record<string,string>)[value]??"Not checked"}
function lifecycleLabel(value:string){return ({account_deletion:"Account deletion",data_export:"Data export",profile_refresh:"Profile refresh",signal_expiry:"Work Signal expiry"} as Record<string,string>)[value]??"Account request"}
function auditLabel(value:string){return ({"profile.updated":"Profile updated","profile.reviewed":"Profile reviewed","privacy.updated":"Privacy settings updated","source.revoked":"Connected source removed","work_signal.revoked":"Work Signal removed","account.deletion_requested":"Account deletion requested","sync.disconnected_all":"Codex disconnected","shared_context.redacted":"Shared connection context removed","matching.paused":"Matching paused","project.deleted":"Project deleted","export.requested":"Data export requested"} as Record<string,string>)[value]??"Account setting changed"}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function emptySubscribe() {
  return () => undefined;
}
