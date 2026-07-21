import type { RepositoryD1 } from "@buildmates/database";
import { MAX_SURFACE_ASSET_BYTES } from "./surface-assets";

const GRANT_TTL_MS = 10 * 60_000;

export async function createSurfaceAssetUploadGrant(
  DB: RepositoryD1,
  origin: string,
  input: { userId: string; contentType: "image/jpeg" | "image/png"; now: string },
) {
  const issuedAt = Date.parse(input.now);
  if (!Number.isFinite(issuedAt)) throw new Error("surface_asset_upload_grant_invalid");
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = issuedAt + GRANT_TTL_MS;
  await DB.prepare("INSERT INTO surface_asset_upload_grants(token_hash,user_id,content_type,expires_at,created_at,consumed_at) VALUES(?,?,?,?,?,NULL)")
    .bind(tokenHash, input.userId, input.contentType, expiresAt, issuedAt).run();
  return {
    uploadUrl: new URL(`/api/surface-assets/upload/${token}`, origin).toString(),
    expiresAt: new Date(expiresAt).toISOString(),
    maximumBytes: MAX_SURFACE_ASSET_BYTES,
    method: "POST" as const,
  };
}

export async function consumeSurfaceAssetUploadGrant(DB: RepositoryD1, token: string, at = Date.now()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const grant = await DB.prepare("SELECT user_id AS userId,content_type AS contentType FROM surface_asset_upload_grants WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?")
    .bind(tokenHash, at).first<{ userId: string; contentType: "image/jpeg" | "image/png" }>();
  if (!grant) return null;
  const claimed = await DB.prepare("UPDATE surface_asset_upload_grants SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?")
    .bind(at, tokenHash, at).run();
  if (Number(claimed.meta?.changes ?? 0) !== 1) return null;
  return grant;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
