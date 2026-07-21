import { describe, expect, it } from "vitest";
import { createSurfaceAssetUploadGrant, consumeSurfaceAssetUploadGrant } from "../../apps/web/src/platform/surface-upload-grants";
import type { RepositoryD1 } from "@buildmates/database";

describe("surface asset upload grants", () => {
  it("issues one opaque short-lived upload URL and consumes it exactly once", async () => {
    const rows = new Map<string, { userId: string; contentType: "image/jpeg" | "image/png"; expiresAt: number; consumedAt: number | null }>();
    const DB = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                if (sql.startsWith("INSERT INTO surface_asset_upload_grants")) {
                  rows.set(String(values[0]), { userId: String(values[1]), contentType: values[2] as "image/jpeg" | "image/png", expiresAt: Number(values[3]), consumedAt: null });
                  return { meta: { changes: 1 } };
                }
                const row = rows.get(String(values[1]));
                if (!row || row.consumedAt !== null || row.expiresAt <= Number(values[2])) return { meta: { changes: 0 } };
                row.consumedAt = Number(values[0]);
                return { meta: { changes: 1 } };
              },
              async first<T>() {
                const row = rows.get(String(values[0]));
                if (!row || row.consumedAt !== null || row.expiresAt <= Number(values[1])) return null;
                return { userId: row.userId, contentType: row.contentType } as T;
              },
            };
          },
        };
      },
    } as unknown as RepositoryD1;
    const now = new Date("2026-07-20T20:00:00.000Z");
    const grant = await createSurfaceAssetUploadGrant(DB, "https://buildmates.example", { userId: "user_yash", contentType: "image/png", now: now.toISOString() });
    expect(grant).toMatchObject({ method: "POST", maximumBytes: 12_000_000, expiresAt: "2026-07-20T20:10:00.000Z" });
    const token = new URL(grant.uploadUrl).pathname.split("/").at(-1)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(consumeSurfaceAssetUploadGrant(DB, token, now.getTime() + 1)).resolves.toEqual({ userId: "user_yash", contentType: "image/png" });
    await expect(consumeSurfaceAssetUploadGrant(DB, token, now.getTime() + 2)).resolves.toBeNull();
  });
});
