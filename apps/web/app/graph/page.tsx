import type { Metadata } from "next";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { BuildGraph } from "../../components/discovery/BuildGraph";
import { getCurrentUser } from "../../src/auth/require-user";
import { getBuildGraph } from "../../src/discovery/service";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../discovery.module.css";

export const metadata: Metadata = {
  title: "Build graph",
  description: "Explore the anonymous topic network taking shape across Buildmates.",
};

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
        <section className={styles.graph} aria-labelledby="topic-field-title">
          <h2 id="topic-field-title" className={styles.srOnly}>Active project topics</h2>
          <BuildGraph topics={graph.topics} edges={graph.edges} relationships={graph.relationships} totalBuilders={graph.totalBuilderCount}/>
        </section>
        {graph.topics.length ? (
            <section className={styles.topicTotals} aria-labelledby="topic-totals-title">
              <div className={styles.sectionHead}>
                <h2 id="topic-totals-title">What builders are exploring</h2>
                <p>A closer look at the ideas moving through Buildmates</p>
              </div>
              <div className={styles.topicTableWrap}>
                <table className={styles.topicTable}>
                  <thead><tr><th scope="col">Topic</th><th scope="col">Contributions</th><th scope="col">Builders</th><th scope="col">Latest activity</th></tr></thead>
                  <tbody>
                    {graph.topics.map((topic) => (
                      <tr key={topic.id}>
                        <th scope="row">{topic.label}</th>
                        <td>{topic.contributionCount}</td>
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
