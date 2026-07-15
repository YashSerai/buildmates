"use client";

import { useState, useSyncExternalStore } from "react";
import { evaluateSurfaceContrast, type SurfaceAction, type SurfaceRendererProps } from "@buildmates/surfaces";
import { SurfaceRenderer } from "../../components/surfaces/SurfaceRenderer";
import { SegmentedControl, SurfaceNotice } from "../../components/surfaces/primitives";
import { fieldNotesRoomSpec, longWorkshopBindings, roomBindings, workshopProfileSpec } from "./fixtures";
import styles from "./surface-lab.module.css";

type Specimen = "profile" | "room";
type Viewport = "phone" | "desktop";
type LabState = NonNullable<SurfaceRendererProps["state"]> | "malformed";

const stateOptions: readonly { value: LabState; label: string }[] = [
  { value: "ready", label: "Ready" }, { value: "loading", label: "Loading" }, { value: "empty", label: "Empty" },
  { value: "error", label: "Error" }, { value: "stale", label: "Stale" }, { value: "permission", label: "Private" }, { value: "malformed", label: "Malformed" },
];

export function SurfaceLabClient() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [specimen, setSpecimen] = useState<Specimen>("profile");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [state, setState] = useState<LabState>("ready");
  const [notice, setNotice] = useState("No product action has been taken in this preview.");
  const activeSpec = specimen === "profile" ? workshopProfileSpec : fieldNotesRoomSpec;
  const spec = state === "malformed" ? { schemaVersion: "1", unsafe: "<script>" } : activeSpec;
  const bindings = specimen === "profile" ? longWorkshopBindings : roomBindings;
  const contrast = state === "malformed" ? null : evaluateSurfaceContrast(activeSpec);
  const handleAction = (action: SurfaceAction, id: string) => setNotice(`${actionLabel(action)} action received from trusted control “${id}”. No action ran inside decorative code.`);
  return (
    <main className={styles.lab} data-hydrated={hydrated ? "true" : "false"}>
      <header className={styles.header}>
        <div><p className={styles.context}>Protected design instrument</p><h1>Surface lab</h1></div>
        <p>Validate generated structure, isolation, content stress, and interface states before publishing a revision.</p>
      </header>
      <section className={styles.controls} aria-label="Preview controls">
        <SegmentedControl label="Specimen" value={specimen} options={[{ value: "profile", label: "Light profile" }, { value: "room", label: "Dark room" }]} onChange={setSpecimen} />
        <SegmentedControl label="Viewport" value={viewport} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setViewport} />
        <label className={styles.stateLabel}>Interface state<select value={state} onChange={(event) => setState(event.target.value as LabState)}>{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </section>
      <SurfaceNotice tone={notice.startsWith("No ") ? "info" : "success"}>{notice}</SurfaceNotice>
      <SurfaceNotice tone={contrast?.passed ? "success" : "warning"}><span data-testid="contrast-result">{contrast ? `${contrast.passed ? "Contrast passed" : "Contrast failed"} · minimum ${contrast.minimumRatio.toFixed(2)}:1 · ${contrast.minimumPair}` : "Contrast unavailable for malformed input"}</span></SurfaceNotice>
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

function noopSubscribe() {
  return () => undefined;
}
