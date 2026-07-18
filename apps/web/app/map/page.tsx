import type { Metadata } from "next";
import Link from "next/link";
import { BuilderMap, type CityAggregate } from "../../components/discovery/BuilderMap";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import { getMapStatistics } from "../../src/discovery/map-statistics";
import { listLocationGroups } from "../../src/discovery/service";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../discovery.module.css";
import headStyles from "../aggregate-head.module.css";

export const metadata: Metadata = {
  title: "Builder map",
  description: "See where the Buildmates community is growing, city by city.",
};

export default async function MapPage() {
  const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]);
  const places: CityAggregate[] = await listLocationGroups(DB, viewer?.id ?? null);
  const statistics = await getMapStatistics(DB, places);

  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(viewer)} />
      <div className={styles.main}>
        <header className={`${styles.head} ${headStyles.aggregateHead}`}>
          <h1>See where builders<br />are gathering.</h1>
          <p>See where the Buildmates community is taking shape. Only city-level anonymous totals appear here.</p>
        </header>
        <BuilderMap places={places} statistics={statistics} />
        {!places.length ? (
          <div className={styles.empty}>
            <h2>The map is just getting started.</h2>
            <p>The first builder who adds a city will put it on the map.</p>
            <Link className={styles.action} href={viewer ? "/profile/edit" : "/onboarding"}>
              {viewer ? "Add your city" : "Create your profile"}
            </Link>
          </div>
        ) : null}
        <p className={styles.privacyNote}>Bubbles use the city saved on a profile. They never show a person, address, or live location.</p>
      </div>
      <ProductFooter />
    </main>
  );
}
