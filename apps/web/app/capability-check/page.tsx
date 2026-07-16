import Link from "next/link";
import { getPlatformIdentity } from "@/src/platform/identity";

export default async function CapabilityCheckPage() {
  const identity = await getPlatformIdentity();
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#5d625f", marginBottom: 8 }}>Platform diagnostic</p>
      <h1 style={{ fontSize: "clamp(2rem, 7vw, 4rem)", lineHeight: 1, margin: "0 0 20px" }}>Buildmates substrate</h1>
      {identity ? (
        <>
          <p>This session has a stable, server-verified identity. Diagnostic API calls remain scoped to this subject.</p>
          <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 20px", marginTop: 28 }}>
            <dt>Identity</dt><dd>Verified</dd>
            <dt>Issuer</dt><dd>{identity.issuer}</dd>
            <dt>Workspace</dt><dd>{identity.workspaceScope}</dd>
          </dl>
          <p style={{ marginTop: 28 }}>D1 and R2 checks are authenticated POST endpoints. This page deliberately exposes no destructive controls.</p>
        </>
      ) : (
        <>
          <p>Public reachability is working. Stable authenticated identity is not present in this request, so storage diagnostics are unavailable.</p>
          <Link href="/api/auth/github/start?return_to=%2Fcapability-check">Sign in with GitHub to run protected checks</Link>
        </>
      )}
      <p style={{ marginTop: 40 }}><Link href="/">Return to Buildmates</Link></p>
    </main>
  );
}
