"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationDestination,
  notificationLabel,
  notificationSummary,
} from "@/src/activity/notification-presentation";
import styles from "./inbox.module.css";
type Item = {
  id: string;
  kind: string;
  delivery: string;
  payload: Record<string, unknown>;
  readAt: number | null;
  createdAt: number;
};
type Page = {
  notifications: Item[];
  newestCursor: string | null;
  oldestCursor: string | null;
  hasMore: boolean;
};
export function InboxClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const newest = useRef<string | null>(null);
  const oldest = useRef<string | null>(null);
  const load = useCallback(
    async (mode: "initial" | "newer" | "older" = "initial") => {
      try {
        const cursor =
          mode === "newer"
            ? newest.current
            : mode === "older"
              ? oldest.current
              : null;
        const query = cursor
          ? `?${mode === "older" ? "before" : "after"}=${encodeURIComponent(cursor)}`
          : "";
        const response = await fetch(`/api/notifications${query}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const page = (await response.json()) as Page;
        if (mode === "initial") setItems(page.notifications);
        else
          setItems((current) =>
            merge(
              mode === "newer"
                ? [...page.notifications, ...current]
                : [...current, ...page.notifications],
            ),
          );
        if (mode !== "older" && page.newestCursor)
          newest.current = page.newestCursor;
        if (page.oldestCursor) oldest.current = page.oldestCursor;
        if (mode !== "newer") setHasMore(page.hasMore);
        setState("ready");
      } catch {
        if (mode === "initial") setState("error");
      }
    },
    [],
  );
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    let poll: number | undefined;
    const schedule = () => {
      if (poll !== undefined) window.clearInterval(poll);
      poll = document.hidden
        ? undefined
        : window.setInterval(() => void load("newer"), 15_000);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(initial);
      if (poll !== undefined) window.clearInterval(poll);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [load]);
  async function markRead(id: string) {
    setPending(`read:${id}`);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read_one", notificationId: id }),
      });
      if (!response.ok) throw new Error();
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: Date.now() } : item,
        ),
      );
    } catch {
      setNotice("That activity could not be marked as read.");
    } finally {
      setPending(null);
    }
  }
  async function markAllRead() {
    setPending("read:all");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      if (!response.ok) throw new Error();
      const readAt = Date.now();
      setItems((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt })),
      );
      setNotice("All activity marked as read.");
    } catch {
      setNotice("Activity could not be updated.");
    } finally {
      setPending(null);
    }
  }
  async function appeal(item: Item) {
    const caseId =
      typeof item.payload.caseId === "string" ? item.payload.caseId : null;
    if (!caseId) return;
    const statement = window
      .prompt(
        "Explain why this outcome should be reviewed again (20 characters minimum):",
      )
      ?.trim();
    if (!statement) return;
    const response = await fetch("/api/moderation-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId, statement }),
    });
    setNotice(
      response.ok
        ? "Appeal received."
        : "This outcome is not currently appealable.",
    );
  }
  if (state === "loading")
    return (
      <div className={`${styles.state} ${styles.loading}`} role="status">
        <strong>Loading activity...</strong>
        <span>Your latest introductions and messages are on the way.</span>
      </div>
    );
  if (state === "error")
    return (
      <div className={`${styles.state} ${styles.errorState}`} role="alert">
        <h2>Activity unavailable</h2>
        <p>
          Your activity is still stored. Check your connection and try again.
        </p>
        <button onClick={() => void load()}>Try again</button>
      </div>
    );
  if (!items.length)
    return (
      <div className={`${styles.state} ${styles.emptyState}`}>
        <h2>Nothing needs your attention</h2>
        <p>
          New introductions, messages, invitations, and reminders will appear
          here.
        </p>
        <a href="/matches">Open introductions</a>
      </div>
    );
  const unreadCount = items.filter((item) => !item.readAt).length;
  return (
    <>
      <div className={styles.toolbar}>
        {unreadCount > 0 && (
          <>
            <p>
              <strong>{unreadCount}</strong> unread
            </p>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void markAllRead()}
            >
              {pending === "read:all" ? "Marking..." : "Mark all read"}
            </button>
          </>
        )}
      </div>
      <section className={styles.list} aria-label="Notifications">
        {items.map((item) => {
          const destination = notificationDestination(item);
          return (
            <article
              key={item.id}
              className={item.readAt ? styles.read : styles.unread}
            >
              <span className={styles.mark} aria-hidden="true" />
              <div>
                <p>{notificationLabel(item.kind)}</p>
                <h2>{notificationSummary(item)}</h2>
                <time
                  suppressHydrationWarning
                  dateTime={new Date(item.createdAt).toISOString()}
                >
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(item.createdAt)}
                </time>
                {destination && (
                  <a href={destination.href}>{destination.label}</a>
                )}
              </div>
              <div>
                {item.kind === "moderation_outcome" && (
                  <button onClick={() => void appeal(item)}>
                    Appeal outcome
                  </button>
                )}
                {!item.readAt && (
                  <button
                    disabled={pending !== null}
                    onClick={() => void markRead(item.id)}
                  >
                    {pending === `read:${item.id}` ? "Marking..." : "Mark read"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
      {hasMore && (
        <button className={styles.loadMore} onClick={() => void load("older")}>
          Load earlier activity
        </button>
      )}
      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </>
  );
}
function merge(items: Item[]) {
  const seen = new Set<string>();
  return items
    .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)))
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
