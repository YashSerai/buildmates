import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import { getBuildGraph } from "../../src/discovery/service";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../discovery.module.css";
import headStyles from "../aggregate-head.module.css";

export const metadata: Metadata = {
  title: "Build graph",
  description: "See aggregate topics from projects that builders deliberately made public.",
};

function bubbleSize(projectCount: number) {
  if (projectCount >= 9) return styles.bubbleSize5;
  if (projectCount >= 5) return styles.bubbleSize4;
  if (projectCount >= 3) return styles.bubbleSize3;
  if (projectCount >= 2) return styles.bubbleSize2;
  return styles.bubbleSize1;
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function activityDate(value: number) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function GraphPage() {
  const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]);
  const graph = await getBuildGraph(DB, viewer?.id ?? null);

  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(viewer)} />
      <div className={styles.main}>
        <header className={`${styles.head} ${headStyles.aggregateHead}`}>
          <h1>See what builders<br />are working on.</h1>
          <p>Explore the ideas, tools, and problems builders across Buildmates are working through right now.</p>
        </header>

        <section className={styles.graph} aria-labelledby="topic-field-title">
          <h2 id="topic-field-title" className={styles.srOnly}>Active project topics</h2>
          {graph.topics.length ? (
              <ul className={styles.bubbleField}>
                {graph.topics.map((topic) => (
                  <li className={`${styles.topicBubble} ${bubbleSize(topic.projectCount)}`} key={topic.id}>
                    <strong>{topic.label}</strong>
                    <span>{countLabel(topic.projectCount, "project")}</span>
                    <small>{countLabel(topic.builderCount, "builder")}</small>
                  </li>
                ))}
              </ul>
          ) : <div className={styles.graphEmpty}><h2>The first topics will appear here soon.</h2><p>Share a project to help the graph come alive.</p><Link className={styles.action} href={viewer ? "/projects/new" : "/onboarding"}>{viewer ? "Share a project" : "Create a profile"}</Link></div>}
        </section>
        {graph.topics.length ? (
            <section className={styles.topicTotals} aria-labelledby="topic-totals-title">
              <div className={styles.sectionHead}>
                <h2 id="topic-totals-title">What builders are exploring</h2>
                <p>A closer look at the ideas moving through Buildmates</p>
              </div>
              <div className={styles.topicTableWrap}>
                <table className={styles.topicTable}>
                  <thead><tr><th scope="col">Topic</th><th scope="col">Projects</th><th scope="col">Builders</th><th scope="col">Latest activity</th></tr></thead>
                  <tbody>
                    {graph.topics.map((topic) => (
                      <tr key={topic.id}>
                        <th scope="row">{topic.label}</th>
                        <td>{topic.projectCount}</td>
                        <td>{topic.builderCount}</td>
                        <td><time dateTime={new Date(topic.latestActivityAt).toISOString()}>{activityDate(topic.latestActivityAt)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
        ) : null}
      </div>
      <ProductFooter />
    </main>
  );
}
