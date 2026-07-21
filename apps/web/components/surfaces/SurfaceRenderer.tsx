"use client";

import { useEffect, useRef } from "react";
import { SurfaceRendererCore, type SurfaceRendererProps } from "@buildmates/surfaces";
import styles from "./SurfaceRenderer.module.css";

export function SurfaceRenderer(props: SurfaceRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = hostRef.current?.querySelector<HTMLIFrameElement>("iframe.surface-generated-site");
    if (!frame) return;
    let observer: ResizeObserver | null = null;
    const resize = () => {
      const document = frame.contentDocument;
      if (!document) return;
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      if (height > 0) frame.style.height = `${height}px`;
    };
    const connect = () => {
      observer?.disconnect();
      resize();
      const document = frame.contentDocument;
      if (!document) return;
      observer = new ResizeObserver(resize);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
    };
    frame.addEventListener("load", connect);
    if (frame.contentDocument?.readyState === "complete") connect();
    return () => {
      frame.removeEventListener("load", connect);
      observer?.disconnect();
    };
  }, [props.spec]);
  return <div className={styles.frameHost} ref={hostRef}><SurfaceRendererCore {...props} className={`${styles.renderer} ${props.className ?? ""}`} /></div>;
}
