"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./ProductForms.module.css";

type Project = { key: string; title: string };
type Media = { assetId: string; projectId: string; projectTitle: string; altText: string; src: string };

export function ProfileProjectMedia({ onChanged }: { onChanged: () => Promise<void> }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [projectKey, setProjectKey] = useState("");
  const [altText, setAltText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/profile-project-media", { cache: "no-store" });
    const value = await response.json() as { projects?: Project[]; media?: Media[]; error?: string };
    if (!response.ok) throw new Error(userFacingError(value.error, "Project artwork could not load."));
    const nextProjects = Array.isArray(value.projects) ? value.projects : [];
    setProjects(nextProjects);
    setMedia(Array.isArray(value.media) ? value.media : []);
    setProjectKey((current) => nextProjects.some((project) => project.key === current) ? current : nextProjects[0]?.key ?? "");
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load).catch((error) => setMessage(error instanceof Error ? error.message : "Project artwork could not load."));
  }, [load]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    const project = projects.find((item) => item.key === projectKey);
    if (!file || !project || !altText.trim()) {
      setMessage("Choose a project and image, then describe what the image shows.");
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size < 1 || file.size > 12_000_000) {
      setMessage("Use a PNG or JPEG up to 12 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const uploadResponse = await fetch("/api/surface-assets", {
        method: "POST",
        headers: { "content-type": file.type },
        body: file,
      });
      const uploadValue = await uploadResponse.json() as { asset?: { id?: string }; error?: string };
      if (!uploadResponse.ok || typeof uploadValue.asset?.id !== "string") throw new Error(userFacingError(uploadValue.error, "That image could not be uploaded."));
      const associationResponse = await fetch("/api/profile-project-media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: uploadValue.asset.id, projectKey: project.key, projectTitle: project.title, altText: altText.trim() }),
      });
      const associationValue = await associationResponse.json() as { error?: string };
      if (!associationResponse.ok) throw new Error(userFacingError(associationValue.error, "That image could not be attached to the project."));
      setAltText("");
      if (fileRef.current) fileRef.current.value = "";
      await Promise.all([load(), onChanged()]);
      setMessage(`${project.title} artwork is ready for your next private design preview.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That image could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.projectMedia} aria-labelledby="project-media-title">
      <div className={styles.projectMediaIntro}>
        <div>
          <p className={styles.previewState}>Optional media</p>
          <h2 id="project-media-title">Give Codex more to work with.</h2>
        </div>
        <p>Add a real screenshot or approved artwork when it helps your story. Codex decides how—or whether—to use it. Uploads stay private unless you publish a design that includes them.</p>
      </div>
      {projects.length ? (
        <form className={styles.projectMediaForm} onSubmit={upload}>
          <label>
            Project
            <select value={projectKey} onChange={(event) => setProjectKey(event.target.value)} disabled={busy}>
              {projects.map((project) => <option key={project.key} value={project.key}>{project.title}</option>)}
            </select>
          </label>
          <label>
            PNG or JPEG
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" disabled={busy} />
          </label>
          <label className={styles.wide}>
            Image description
            <input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={300} placeholder="What someone should understand if they cannot see the image" disabled={busy} />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Adding artwork..." : "Add to project"}</button>
        </form>
      ) : (
        <p className={styles.projectMediaEmpty}>Approve at least one public project in your profile draft before adding project artwork.</p>
      )}
      {media.length ? (
        <ul className={styles.projectMediaList} aria-label="Attached project artwork">
          {media.map((item) => (
            <li key={item.assetId}>
              {/* This authenticated URL stays private until a published SurfaceSpec authorizes it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" />
              <span><strong>{item.projectTitle}</strong>{item.altText}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className={styles.designStatus} role="status">{message}</p> : null}
    </section>
  );
}
