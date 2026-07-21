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
    let settleTimer = 0;
    let imageCleanups: Array<() => void> = [];
    const resize = () => {
      const document = frame.contentDocument;
      if (!document?.documentElement) return;
      // Collapse the frame before measuring so its previous content height
      // cannot feed back into the document. Generated pages are fluid,
      // continuous documents; the saved responsive heights are metadata rather
      // than a canvas enforced by the renderer.
      const previousHeight = frame.style.height;
      frame.style.height = "0px";
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      frame.style.height = height > 0 ? `${height}px` : previousHeight;
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
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(scheduleResize, 120);
    };
    frame.addEventListener("load", connect);
    window.addEventListener("resize", scheduleResize);
    if (frame.contentDocument?.readyState === "complete") connect();
    return () => {
      frame.removeEventListener("load", connect);
      window.removeEventListener("resize", scheduleResize);
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(settleTimer);
      imageCleanups.forEach((cleanup) => cleanup());
    };
  }, [props.spec]);
  return <div className={styles.frameHost} ref={hostRef}><SurfaceRendererCore {...props} className={`${styles.renderer} ${props.className ?? ""}`} /></div>;
}
