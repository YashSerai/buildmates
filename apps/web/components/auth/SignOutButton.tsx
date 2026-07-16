"use client";

import { useState } from "react";

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return <button className={className} type="button" disabled={busy} onClick={async () => {
    setBusy(true);
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) location.assign("/"); else setBusy(false);
  }}>{busy ? "Signing out…" : "Sign out"}</button>;
}
