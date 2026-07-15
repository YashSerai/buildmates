import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const SUBJECT_HEADER = "oai-authenticated-user-id";
const EMAIL_HEADER = "oai-authenticated-user-email";
const NAME_HEADER = "oai-authenticated-user-full-name";
const NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const ISSUER_HEADER = "oai-authenticated-user-issuer";
const SIGN_IN_PATH = "/signin-with-chatgpt";

export type PlatformIdentity = {
  channel: "web";
  issuer: string;
  subject: string;
  workspaceScope: string;
  displayName: string | null;
};

export async function getPlatformIdentity(): Promise<PlatformIdentity | null> {
  const requestHeaders = await headers();
  const subject = requestHeaders.get(SUBJECT_HEADER)?.trim();
  if (!subject) return null;

  const encodedName = requestHeaders.get(NAME_HEADER);
  const displayName =
    encodedName && requestHeaders.get(NAME_ENCODING_HEADER) === "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : encodedName;

  return {
    channel: "web",
    issuer: requestHeaders.get(ISSUER_HEADER)?.trim() || "chatgpt_sites",
    subject,
    workspaceScope: "global",
    displayName: displayName?.trim() || null,
  };
}

export async function requirePlatformIdentity(returnTo: string): Promise<PlatformIdentity> {
  const identity = await getPlatformIdentity();
  if (identity) return identity;
  redirect(`${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export async function requireApiIdentity(): Promise<PlatformIdentity | Response> {
  const identity = await getPlatformIdentity();
  return identity ?? Response.json({ error: "authentication_required" }, { status: 401 });
}

// This is a stable opaque application key, not an account merge heuristic.
export function internalUserKey(identity: PlatformIdentity): string {
  return `usr_${createHash("sha256")
    .update(`${identity.channel}\0${identity.issuer}\0${identity.subject}\0${identity.workspaceScope}`)
    .digest("hex")}`;
}

export function hasUnstableIdentityHint(requestHeaders: Headers): boolean {
  return Boolean(requestHeaders.get(EMAIL_HEADER)) && !requestHeaders.get(SUBJECT_HEADER);
}

function safeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://app.local");
    if (parsed.origin !== "https://app.local") return "/";
    if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(parsed.pathname)) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
