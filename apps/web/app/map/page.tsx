import type { Metadata } from "next";
import Link from "next/link";
import { BuilderMap, type CityAggregate } from "../../components/discovery/BuilderMap";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import { getMapStatistics } from "../../src/discovery/map-statistics";
import { listLocationGroups } from "../../src/discovery/service";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../discovery.module.css";

export const metadata: Metadata = {
  title: "Builder map",
  description: "See aggregate Buildmates activity across cities without exposing precise location.",
};

export default async function MapPage() {
  const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]);
  const places: CityAggregate[] = await listLocationGroups(DB, viewer?.id ?? null);
  const statistics = await getMapStatistics(DB, places);

  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(viewer)} />
      <div className={styles.main}>
        <header className={styles.head}>
          <h1>A map without<br />the pin drop.</h1>
          <p>Cities appear only after five builders opt in. Individual locations are never shown.</p>
        </header>
        <BuilderMap places={places} statistics={statistics} />
        {!places.length ? (
          <div className={styles.empty}>
            <h2>No city aggregates yet.</h2>
            <p>A city appears once at least five visible builders choose to join its aggregate. Exact coordinates are never collected.</p>
            <Link className={styles.action} href={viewer ? "/profile/edit" : "/onboarding"}>
              {viewer ? "Review location sharing" : "Create your profile"}
            </Link>
          </div>
        ) : null}
        <p className={styles.privacyNote}>Markers use a fixed city center and scale with the number of opted-in builders. They do not represent distance or where anyone is right now.</p>
      </div>
      <ProductFooter />
    </main>
  );
}
