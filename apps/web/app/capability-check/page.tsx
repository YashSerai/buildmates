import Link from "next/link";
import { getPlatformIdentity } from "@/src/platform/identity";

export default async function CapabilityCheckPage() {
  const identity = await getPlatformIdentity();
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#5d625f", marginBottom: 8 }}>Connection check</p>
      <h1 style={{ fontSize: "clamp(2rem, 7vw, 4rem)", lineHeight: 1, margin: "0 0 20px" }}>Is Buildmates ready?</h1>
      {identity ? (
        <>
          <p>You are signed in. Protected checks can use only this Buildmates account.</p>
          <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 20px", marginTop: 28 }}>
            <dt>Account</dt><dd>Connected</dd>
            <dt>Sign-in provider</dt><dd>GitHub</dd>
            <dt>Data access</dt><dd>Limited to this account</dd>
          </dl>
          <p style={{ marginTop: 28 }}>Database and file-storage checks require sign-in. This page cannot change or delete account data.</p>
        </>
      ) : (
        <>
          <p>Buildmates is reachable, but database and file-storage checks need a signed-in account.</p>
          <Link href="/api/auth/github/start?return_to=%2Fcapability-check">Sign in with GitHub to continue</Link>
        </>
      )}
      <p style={{ marginTop: 40 }}><Link href="/">Return to Buildmates</Link></p>
    </main>
  );
}
