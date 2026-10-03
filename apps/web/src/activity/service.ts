import { materializeRelationshipNotifications } from "../rooms/lifecycle";

export type ActivityItem = {
  id: string;
  kind: string;
  delivery: string;
  payload: Record<string, unknown>;
  readAt: number | null;
  createdAt: number;
};

export async function listActivity(
  DB: D1Database,
  input: { userId: string; cursor?: string; limit?: number; now: number },
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  await materializeRelationshipNotifications(DB, input.userId, input.now);
  const limit = Math.max(1, Math.min(100, input.limit ?? 50));
  const cursor = parseActivityCursor(input.cursor);
  const statement = cursor
    ? DB.prepare(`SELECT id,kind,delivery,payload_json AS payloadJson,read_at AS readAt,created_at AS createdAt
        FROM notifications WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?))
        ORDER BY created_at DESC,id DESC LIMIT ?`).bind(input.userId, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
    : DB.prepare(`SELECT id,kind,delivery,payload_json AS payloadJson,read_at AS readAt,created_at AS createdAt
        FROM notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT ?`).bind(input.userId, limit + 1);
  const rows = await statement.all<{ id: string; kind: string; delivery: string; payloadJson: string; readAt: number | null; createdAt: number }>();
  const page = rows.results.slice(0, limit);
  const items = page.map(({ payloadJson, ...row }) => ({ ...row, payload: safePayload(payloadJson) }));
  return { items, nextCursor: rows.results.length > limit && page.length ? activityCursor(page[page.length - 1]!) : null };
}

export async function markActivityRead(
  DB: D1Database,
  input: { userId: string; notificationId?: string; all?: boolean; now: number },
): Promise<{ updated: number }> {
  if (input.all === true) {
    const result = await DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND read_at IS NULL")
      .bind(input.now, input.userId).run();
    return { updated: Number(result.meta?.changes ?? 0) };
  }
  if (!input.notificationId) throw new Error("notification_id_required");
  const result = await DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?")
    .bind(input.now, input.notificationId, input.userId).run();
  if (Number(result.meta?.changes ?? 0) !== 1) throw new Error("notification_not_found");
  return { updated: 1 };
}

export function activityCursor(item: Pick<ActivityItem, "createdAt" | "id">): string {
  return `${item.createdAt}:${encodeURIComponent(item.id)}`;
}

function parseActivityCursor(value: string | undefined): { createdAt: number; id: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 1) throw new Error("invalid_activity_cursor");
  const createdAt = Number(value.slice(0, separator));
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error("invalid_activity_cursor");
  try {
    const id = decodeURIComponent(value.slice(separator + 1));
    if (!id) throw new Error("invalid_activity_cursor");
    return { createdAt, id };
  } catch {
    throw new Error("invalid_activity_cursor");
  }
}

function safePayload(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
