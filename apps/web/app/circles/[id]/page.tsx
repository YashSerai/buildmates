import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseSurfaceSpecJson } from "@buildmates/surfaces";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getCircle, listCircleMessages, listCircleModuleEntries, type CircleMessage, type CircleModuleEntry } from "@/src/circles/service";
import { CircleClient } from "./CircleClient";
import styles from "./circle.module.css";

export const metadata: Metadata = { title: "Circle | Buildmates", description: "A private Buildmates Circle.", robots: { index: false, follow: false } };

export default async function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/circles/${encodeURIComponent(id)}`);
  const { DB } = await getPlatformBindings();
  const circle = await getCircle(DB, id, user.id);
  if (!circle) notFound();
  const active = circle.membershipStatus === "active" && circle.status === "active";
  let messages: CircleMessage[] = [];
  let entries: CircleModuleEntry[] = [];
  let published: {specJson:string} | null = null;
  if (active) [messages, entries, published] = await Promise.all([
    listCircleMessages(DB, id, user.id),
    listCircleModuleEntries(DB, id, user.id),
    DB.prepare("SELECT revision.spec_json AS specJson FROM surfaces surface JOIN surface_revisions revision ON revision.id=surface.published_revision_id WHERE surface.kind='circle' AND surface.subject_id=? LIMIT 1").bind(id).first<{specJson:string}>(),
  ]);
  let surfaceSpec: unknown = null;
  if (published?.specJson) {
    try { surfaceSpec = parseSurfaceSpecJson(published.specJson); }
    catch { surfaceSpec = null; }
  }
  const bindings = {
    "circle.name": circle.name,
    "circle.purpose": circle.purpose,
    "circle.members": circle.members.map((member) => ({ label: member.displayName, value: member.role })),
    "circle.modules": circle.modules.filter((module) => module.active).map((module) => ({ label: String(module.config.title ?? module.kind.replaceAll("_", " ")), value: module.kind.replaceAll("_", " ") })),
    "circle.metrics": [
      { label: "Members", value: String(circle.members.filter((member) => member.status === "active").length) },
      { label: "Active modules", value: String(circle.modules.filter((module) => module.active).length) },
    ],
  };
  return <main className={styles.page}>
    <header><a href="/circles">← Circles</a><a href="/">Buildmates</a><a href="/inbox">Inbox</a></header>
    {surfaceSpec
      ? <SurfaceRenderer spec={surfaceSpec} bindings={bindings} />
      : <section className={styles.intro}><p>{circle.governanceMode} governance</p><h1>{circle.name}</h1><span>{circle.purpose}</span></section>}
    <CircleClient initialCircle={circle} initialMessages={messages} initialEntries={entries} />
  </main>;
}
