import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "../../components/auth/SignOutButton";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../info.module.css";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const user = await getCurrentUser();
  const query = await searchParams;
  let profile: null | { handle: string; displayName: string } = null;
  if (user) {
    const { DB } = await getPlatformBindings();
    profile = await DB.prepare("SELECT h.handle,p.display_name AS displayName FROM profiles p JOIN handles h ON h.user_id=p.user_id WHERE p.user_id=?")
      .bind(user.id).first<{ handle: string; displayName: string }>() ?? null;
  }
  return <main className={styles.page}><ProductHeader signedIn={Boolean(user)} /><article className={styles.article}>
    <h1>{user ? "Your Buildmates account" : "Sign in to Buildmates."}</h1>
    {user ? <>
      <p className={styles.lead}>Signed in as {profile?.displayName ?? "a Buildmates member"}.</p>
      <div className={styles.status}><strong>{profile ? `@${profile.handle}` : "Profile setup is not finished"}</strong><span>{profile ? "Your profile and network controls are ready." : "Complete onboarding to publish a builder profile."}</span></div>
      <Link className={styles.action} href={profile ? `/@${profile.handle}` : "/onboarding"}>{profile ? "View your profile" : "Finish onboarding"}</Link>
      <SignOutButton className={styles.secondary} />
    </> : <>
      <p className={styles.lead}>Sign in with GitHub to create your Buildmates website account. Buildmates uses your GitHub account ID for sign-in only; it does not request repository access. You can then link this account to Buildmates in Codex with a separate one-time approval.</p>
      {query.auth_error ? <p role="alert">GitHub sign-in did not finish. Please try again.</p> : null}
      <Link className={styles.action} href="/api/auth/github/start?return_to=%2Faccount">Continue with GitHub</Link>
    </>}
  </article><ProductFooter /></main>;
}
