"use client";

import { SurfaceRendererCore, type SurfaceRendererProps } from "@buildmates/surfaces";
import styles from "./SurfaceRenderer.module.css";

export function SurfaceRenderer(props: SurfaceRendererProps) {
  return <SurfaceRendererCore {...props} className={`${styles.renderer} ${props.className ?? ""}`} />;
}
