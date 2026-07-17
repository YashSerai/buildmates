import type { Metadata } from "next";
import Link from "next/link";
import {
  ProductFooter,
  ProductHeader,
} from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "The Buildmates data and connected-app privacy model.",
};

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(user)} />
      <article className={styles.article}>
        <h1>Your work stays yours.</h1>
        <p className={styles.lead}>
          You choose what Codex may use, what appears on your profile, and what
          can help with recommendations. Buildmates never receives your
          passwords or the full contents of connected apps.
        </p>
        <section>
          <h2>Choose for every app</h2>
          <div>
            <ul>
              <li>
                <strong>Never use:</strong> Buildmates ignores this app.
              </li>
              <li>
                <strong>Ask each time:</strong> Codex asks before using anything
                from it.
              </li>
              <li>
                <strong>Allow approved summaries:</strong> Codex may share short
                summaries you have approved.
              </li>
              <li>
                <strong>Actions only:</strong> Codex may complete an action you
                approve without using that app to understand your work.
              </li>
            </ul>
            <p>
              Your existing ChatGPT, Codex, and app permissions still apply.
            </p>
          </div>
        </section>
        <section>
          <h2>Connecting Codex</h2>
          <div>
            <p>
              Signing in creates your Buildmates account. Connecting Codex lets
              it update that same account and look for relevant people. You can
              disconnect Codex without deleting your profile or projects.
            </p>
          </div>
        </section>
        <section>
          <h2>Choose what each person sees</h2>
          <div>
            <p>
              Profile details and projects can be public, limited to signed-in
              builders, shared with suggested connections, shared with your
              connections, or kept private. Details used for recommendations do
              not become public unless you publish them separately.
            </p>
          </div>
        </section>
        <section>
          <h2>Change your mind anytime</h2>
          <div>
            <p>
              Remove a connected app, pause recommendations, export your data,
              disconnect Codex, or delete your account whenever you like.
              Account deletion removes or anonymizes your profile, projects,
              pages, messages, scheduling details, and uploaded assets.
              Buildmates keeps only the limited safety records needed to prevent
              abuse.
            </p>
            <p>
              Custom profile designs cannot run scripts, submit forms, open
              popups, or load unapproved content.
            </p>
            {user ? (
              <Link className={styles.action} href="/settings/privacy">
                Open privacy controls
              </Link>
            ) : (
              <Link className={styles.action} href="/account">
                Sign in to manage privacy
              </Link>
            )}
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
