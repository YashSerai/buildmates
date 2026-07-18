"use client";

import { FormEvent, useState } from "react";
import { SafetyReportDialog } from "@/components/safety/SafetyReportDialog";
import type { ConnectionListItem } from "@/src/rooms/service";
import styles from "./connections.module.css";

type Detail = {
  state: "active" | "ended";
  muted: boolean;
  renewedRelevanceEnabled: boolean;
  updatesEnabled: boolean;
  privateNote: string | null;
  otherUserId: string;
  reminders: { id: string; remindAt: number }[];
  reconnect: { id: string; requesterUserId: string } | null;
};

export function ConnectionsClient({
  initialConnections,
}: {
  initialConnections: ConnectionListItem[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [notice, setNotice] = useState("");
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function refresh(id: string) {
    try {
      const response = await fetch(
        `/api/connections/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const detail = (await response.json()) as Detail;
      setDetails((current) => ({ ...current, [id]: detail }));
      setLoadErrors((current) => ({ ...current, [id]: false }));
    } catch {
      setLoadErrors((current) => ({ ...current, [id]: true }));
    }
  }
  async function toggle(id: string) {
    setOpen((current) => (current === id ? null : id));
    if (!details[id]) await refresh(id);
  }
  async function command(
    id: string,
    body: object,
    success = "Connection updated.",
  ) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/connections/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error();
      await refresh(id);
      setNotice(success);
      return true;
    } catch {
      setNotice(
        "This Connection could not be updated. Check your connection and try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function block(connection: ConnectionListItem) {
    if (
      !window.confirm(
        `Block ${connection.otherName}? They will no longer be able to contact you.`,
      )
    )
      return;
    const body = { action: "block", targetUserId: connection.otherUserId };
    const response = await fetch("/api/safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok)
      setConnections((current) =>
        current.filter((item) => item.id !== connection.id),
      );
    setNotice(
      response.ok
        ? "Builder blocked."
        : "That safety action could not be completed.",
    );
  }

  return (
    <section className={styles.list} aria-label="Connections">
      {connections.map((connection) => {
        const detail = details[connection.id];
        const state = detail?.state ?? connection.state;
        return (
          <article
            key={connection.id}
            id={connection.id}
            className={styles.connection}
          >
            <div className={styles.summary}>
              <div className={styles.avatar} aria-hidden="true">
                {connection.otherName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2>{connection.otherName}</h2>
                <p>{connection.otherSummary}</p>
                <p>
                  <strong>Why you met:</strong> {connection.connectionReason}
                </p>
                {connection.sharedContext.length > 0 && (
                  <ul>
                    {connection.sharedContext.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <span suppressHydrationWarning>
                  Connected{" "}
                  {new Date(connection.createdAt).toLocaleDateString("en-US")} /{" "}
                  {state === "active" ? "Active" : "Ended"}
                  {(detail?.muted ?? connection.muted)
                    ? " / Notifications muted"
                    : ""}
                </span>
              </div>
              <div className={styles.actions}>
                {state === "active" && (
                  <a href={`/rooms/${connection.roomId}`}>Open room</a>
                )}
                <button
                  type="button"
                  onClick={() => void toggle(connection.id)}
                  aria-expanded={open === connection.id}
                >
                  Manage connection
                </button>
              </div>
            </div>
            {open === connection.id && (
              <div className={styles.manage}>
                {detail ? (
                  <>
                    <div className={styles.toggles} aria-busy={busy}>
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={detail.muted}
                          onChange={(event) =>
                            void command(
                              connection.id,
                              {
                                action: "preference",
                                kind: "muted",
                                enabled: event.target.checked,
                              },
                              event.target.checked
                                ? "Notifications from this Connection are muted."
                                : "Notifications from this Connection are on.",
                            )
                          }
                        />
                        Mute notifications
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={detail.updatesEnabled}
                          onChange={(event) =>
                            void command(
                              connection.id,
                              {
                                action: "preference",
                                kind: "updates",
                                enabled: event.target.checked,
                              },
                              event.target.checked
                                ? "Public project updates are on."
                                : "Public project updates are off.",
                            )
                          }
                        />
                        Show public project updates
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={detail.renewedRelevanceEnabled}
                          onChange={(event) =>
                            void command(
                              connection.id,
                              {
                                action: "preference",
                                kind: "renewed_relevance",
                                enabled: event.target.checked,
                              },
                              event.target.checked
                                ? "Buildmates will tell you when your public work becomes relevant again."
                                : "Renewed-relevance alerts are off.",
                            )
                          }
                        />
                        Tell me when our work overlaps again
                      </label>
                    </div>
                    <NoteForm
                      initial={detail.privateNote ?? ""}
                      disabled={busy}
                      onSave={(body) =>
                        command(
                          connection.id,
                          { action: "private_note", body },
                          "Private note saved. Only you can see it.",
                        )
                      }
                    />
                    <ReminderForm
                      disabled={busy}
                      onSave={(remindAt) =>
                        command(
                          connection.id,
                          { action: "reminder", remindAt },
                          "Private reconnect reminder set.",
                        )
                      }
                    />
                    {detail.reminders.length ? (
                      <div>
                        <strong>Upcoming reminders</strong>
                        <ul>
                          {detail.reminders.map((reminder) => (
                            <li key={reminder.id}>
                              <time
                                dateTime={new Date(
                                  reminder.remindAt,
                                ).toISOString()}
                              >
                                {new Date(reminder.remindAt).toLocaleString(
                                  "en-US",
                                )}
                              </time>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void command(
                                    connection.id,
                                    {
                                      action: "dismiss_reminder",
                                      reminderId: reminder.id,
                                    },
                                    "Reminder removed.",
                                  )
                                }
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <FeedbackForm
                      disabled={busy}
                      onSave={(value) =>
                        command(
                          connection.id,
                          { action: "feedback", ...value },
                          "Private feedback saved. It will improve future recommendations.",
                        )
                      }
                    />
                    <div className={styles.lifecycle}>
                      {detail.state === "active" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            window.confirm(
                              "End this Connection? Its room will close, and reconnecting will require a new request.",
                            ) &&
                            void command(
                              connection.id,
                              { action: "end" },
                              "Connection ended. Its room is now closed.",
                            )
                          }
                        >
                          End connection
                        </button>
                      ) : detail.reconnect &&
                        detail.reconnect.requesterUserId ===
                          detail.otherUserId ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void command(
                              connection.id,
                              {
                                action: "respond_reconnect",
                                requestId: detail.reconnect!.id,
                                response: "accepted",
                              },
                              "Reconnect accepted. Your Connection and room are active again.",
                            )
                          }
                        >
                          Accept reconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void command(
                              connection.id,
                              { action: "reconnect" },
                              "Reconnect request sent. The other person must accept before the room reopens.",
                            )
                          }
                        >
                          Request to reconnect
                        </button>
                      )}
                      <SafetyReportDialog
                        targetKind="room"
                        targetId={connection.roomId}
                        targetLabel={`the Connection with ${connection.otherName}`}
                        triggerLabel="Report"
                        onSubmitted={() =>
                          setNotice(
                            "Private report submitted. Review its status in Settings > Safety.",
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => void block(connection)}
                      >
                        Block
                      </button>
                    </div>
                  </>
                ) : loadErrors[connection.id] ? (
                  <div className={styles.manageState} role="alert">
                    <p>Connection controls could not load.</p>
                    <button
                      type="button"
                      onClick={() => void refresh(connection.id)}
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <p className={styles.manageState} role="status">
                    Loading controls...
                  </p>
                )}
              </div>
            )}
          </article>
        );
      })}
      <p className={styles.notice} role="status">
        {notice}
      </p>
    </section>
  );
}

function NoteForm({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (body: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(body);
      }}
    >
      <label>
        Private note
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Only you can see this."
        />
      </label>
      <button disabled={disabled}>Save note</button>
    </form>
  );
}
function ReminderForm({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (at: number) => Promise<boolean>;
}) {
  const [at, setAt] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (at) void onSave(new Date(at).getTime());
      }}
    >
      <label>
        Reconnect reminder
        <input
          type="datetime-local"
          value={at}
          onChange={(event) => setAt(event.target.value)}
        />
      </label>
      <button disabled={disabled || !at}>Set reminder</button>
    </form>
  );
}
function FeedbackForm({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (value: object) => Promise<boolean>;
}) {
  const [useful, setUseful] = useState(true);
  const [reason, setReason] = useState("good_conversation");
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave({
          useful,
          reasons: [reason],
          similarMatchPreference: "same",
          followUpIntent: useful ? "keep_connected" : "not_now",
          privateNote: null,
        });
      }}
    >
      <fieldset>
        <legend>How was the introduction?</legend>
        <label>
          <input
            type="radio"
            name="feedback"
            checked={useful}
            onChange={() => setUseful(true)}
          />
          Useful
        </label>
        <label>
          <input
            type="radio"
            name="feedback"
            checked={!useful}
            onChange={() => setUseful(false)}
          />
          Not for me
        </label>
      </fieldset>
      <label>
        What stood out?
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          <option value="good_conversation">Good conversation</option>
          <option value="shared_context">Shared context</option>
          <option value="future_relevance">Future relevance</option>
          <option value="collaboration_started">
            We started collaborating
          </option>
          <option value="timing_off">Timing was off</option>
          <option value="not_relevant">Not relevant</option>
        </select>
      </label>
      <button disabled={disabled}>Save feedback</button>
    </form>
  );
}
