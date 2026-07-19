"use client";

import { useState, useSyncExternalStore } from "react";
import { evaluateSurfaceContrast, PORTFOLIO_QUALITY_BINDINGS, PROFILE_FIXTURE_BINDINGS, PROFILE_V2_FIXTURES, type SurfaceAction, type SurfaceRendererProps } from "@buildmates/surfaces";
import { SurfaceRenderer } from "../../components/surfaces/SurfaceRenderer";
import { SegmentedControl, SurfaceNotice } from "../../components/surfaces/primitives";
import { fieldNotesRoomSpec, longWorkshopBindings, roomBindings, workshopProfileSpec } from "./fixtures";
import styles from "./surface-lab.module.css";

type Specimen = "orbital" | "editorial" | "journal" | "collage" | "ledger" | "atlas" | "workshop" | "room";
type Viewport = "phone" | "desktop";
type LabState = NonNullable<SurfaceRendererProps["state"]> | "malformed";

const fixtureIndex = { orbital: 0, editorial: 1, journal: 2, collage: 3, ledger: 4, atlas: 5 } as const;
const stateOptions: readonly { value: LabState; label: string }[] = [
  { value: "ready", label: "Ready" }, { value: "loading", label: "Loading" }, { value: "empty", label: "Empty" },
  { value: "error", label: "Error" }, { value: "stale", label: "Stale" }, { value: "permission", label: "Private" }, { value: "malformed", label: "Malformed" },
];

export function SurfaceLabClient() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [specimen, setSpecimen] = useState<Specimen>("orbital");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [state, setState] = useState<LabState>("ready");
  const [notice, setNotice] = useState("No product action has been taken in this preview.");
  const activeSpec = specimen === "workshop" ? workshopProfileSpec : specimen === "room" ? fieldNotesRoomSpec : PROFILE_V2_FIXTURES[fixtureIndex[specimen]];
  const spec = state === "malformed" ? { schemaVersion: "1", unsafe: "<script>" } : activeSpec;
  const bindings = specimen === "workshop" ? longWorkshopBindings : specimen === "room" ? roomBindings : specimen === "atlas" ? PORTFOLIO_QUALITY_BINDINGS : PROFILE_FIXTURE_BINDINGS;
  const contrast = state === "malformed" ? null : evaluateSurfaceContrast(activeSpec);
  const handleAction = (action: SurfaceAction, id: string) => setNotice(`${actionLabel(action)} action received from trusted control "${id}". No action ran inside decorative code.`);
  return (
    <main className={styles.lab} data-hydrated={hydrated ? "true" : "false"}>
      <header className={styles.header}>
        <div><p className={styles.context}>Protected design instrument</p><h1>Surface lab</h1></div>
        <p>Compare full-page compositions, responsive reading order, isolation, content stress, and interface states before publishing a revision.</p>
      </header>
      <section className={styles.controls} aria-label="Preview controls">
        <label className={styles.stateLabel}>Concept<select aria-label="Concept" value={specimen} onChange={(event) => setSpecimen(event.target.value as Specimen)}>
          <option value="orbital">Orbital builder</option><option value="editorial">Editorial research index</option><option value="journal">Field journal</option><option value="collage">Maker collage</option><option value="ledger">Data ledger</option><option value="atlas">Working atlas portfolio</option><option value="workshop">Sandboxed workshop</option><option value="room">Dark room</option>
        </select></label>
        <SegmentedControl label="Viewport" value={viewport} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setViewport} />
        <label className={styles.stateLabel}>Interface state<select value={state} onChange={(event) => setState(event.target.value as LabState)}>{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </section>
      <SurfaceNotice tone={notice.startsWith("No ") ? "info" : "success"}>{notice}</SurfaceNotice>
      <SurfaceNotice tone={contrast?.passed ? "success" : "warning"}><span data-testid="contrast-result">{contrast ? `${contrast.passed ? "Contrast passed" : "Contrast failed"} - minimum ${contrast.minimumRatio.toFixed(2)}:1 - ${contrast.minimumPair}` : "Contrast unavailable for malformed input"}</span></SurfaceNotice>
      <section className={styles.stage} aria-label={`${viewport} preview`}>
        <div className={viewport === "phone" ? styles.phone : styles.desktop} data-testid="preview-frame" style={{ width: "100%", maxWidth: viewport === "phone" ? "375px" : "none" }}>
          <SurfaceRenderer spec={spec} bindings={bindings} state={state === "malformed" ? "ready" : state} onAction={handleAction} />
        </div>
      </section>
      <aside className={styles.policy}><strong>Isolation in this preview</strong><p>Decorative HTML and CSS render in a credentialless sandbox without scripts, forms, navigation, same-origin access, or network access. Product actions stay in the trusted component tree.</p></aside>
    </main>
  );
}

function actionLabel(action: SurfaceAction): string {
  return ({ connect: "Connect", follow: "Follow", report: "Report", privacy: "Privacy", navigate: "Navigation" })[action];
}
function noopSubscribe() { return () => undefined; }
