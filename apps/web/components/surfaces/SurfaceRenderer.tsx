"use client";

import { useEffect, useRef } from "react";
import { SurfaceRendererCore, type SurfaceRendererProps } from "@buildmates/surfaces";
import styles from "./SurfaceRenderer.module.css";

export function SurfaceRenderer(props: SurfaceRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = hostRef.current?.querySelector<HTMLIFrameElement>("iframe.surface-generated-site");
    if (!frame) return;
    let animationFrame = 0;
    let imageCleanups: Array<() => void> = [];
    const resize = () => {
      const document = frame.contentDocument;
      if (!document?.documentElement) return;
      // Measure against the trusted minimum viewport, not the frame's previous
      // content height. Generated pages may legitimately use vh/min-height:
      // 100%; measuring those against an already-expanded iframe creates an
      // unbounded resize feedback loop.
      frame.style.height = "0px";
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      if (height > 0) frame.style.height = `${height}px`;
    };
    const scheduleResize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(resize);
    };
    const connect = () => {
      imageCleanups.forEach((cleanup) => cleanup());
      imageCleanups = [];
      const document = frame.contentDocument;
      if (!document) return;
      document.querySelectorAll("img").forEach((image) => {
        if (image.complete) return;
        image.addEventListener("load", scheduleResize);
        image.addEventListener("error", scheduleResize);
        imageCleanups.push(() => {
          image.removeEventListener("load", scheduleResize);
          image.removeEventListener("error", scheduleResize);
        });
      });
      scheduleResize();
    };
    frame.addEventListener("load", connect);
    window.addEventListener("resize", scheduleResize);
    if (frame.contentDocument?.readyState === "complete") connect();
    return () => {
      frame.removeEventListener("load", connect);
      window.removeEventListener("resize", scheduleResize);
      cancelAnimationFrame(animationFrame);
      imageCleanups.forEach((cleanup) => cleanup());
    };
  }, [props.spec]);
  return <div className={styles.frameHost} ref={hostRef}><SurfaceRendererCore {...props} className={`${styles.renderer} ${props.className ?? ""}`} /></div>;
}
