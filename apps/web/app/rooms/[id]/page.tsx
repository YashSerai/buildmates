import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getRoomSummary, listMessages } from "@/src/rooms/service";
import { listRoomEnhancements } from "@/src/rooms/lifecycle";
import { RoomClient, type RoomEnhancements } from "./RoomClient";
import { RoomDesignClient } from "./RoomDesignClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./room.module.css";

export const metadata: Metadata = {
  title: "Room",
  description: "A private Buildmates introduction room.",
  robots: { index: false, follow: false },
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/rooms/${encodeURIComponent(id)}`);
  const { DB } = await getPlatformBindings();
  const room = await getRoomSummary(DB, id, user.id);
  if (!room) notFound();
  const [messages, enhancements, presentation] = await Promise.all([
    listMessages(DB, id, user.id, null, 100),
    listRoomEnhancements(DB, id, user.id),
    DB.prepare(
      `SELECT revision.spec_json AS specJson,context.reason,context.shared_context_json AS sharedContextJson
      FROM rooms room_row
      LEFT JOIN connection_context_snapshots context ON context.connection_id=room_row.connection_id
      LEFT JOIN surfaces surface ON surface.kind='room' AND surface.subject_id=room_row.id
      LEFT JOIN surface_revisions revision ON revision.id=surface.published_revision_id AND revision.status='published'
      WHERE room_row.id=? LIMIT 1`,
    )
      .bind(id)
      .first<{
        specJson: string | null;
        reason: string | null;
        sharedContextJson: string | null;
      }>(),
  ]);
  let spec: unknown = null;
  let sharedFacts: string[] = [];
  try {
    spec = presentation?.specJson ? JSON.parse(presentation.specJson) : null;
  } catch {
    spec = null;
  }
  try {
    const parsed: unknown = presentation?.sharedContextJson
      ? JSON.parse(presentation.sharedContextJson)
      : [];
    sharedFacts = Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, 4)
      : [];
  } catch {
    sharedFacts = [];
  }
  const bindings = {
    "room.title": `${room.otherName} & You`,
    "room.whyTitle": room.themeLabel
      ? `Why ${room.themeLabel} connected you`
      : "Why Buildmates connected you",
    "room.whyBody":
      presentation?.reason ??
      "Buildmates found mutual relevance in your current work.",
    "room.sharedFacts": sharedFacts,
    "room.privacyNote":
      "Only context authorized for both people appears here. Messages never feed back into matching.",
  };

  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.page}>
        <nav className={styles.contextNav} aria-label="Room context">
          <a href="/connections">Back to Connections</a>
          <span>{room.otherName} &amp; You</span>
        </nav>
        {spec ? (
          <section className={styles.surfaceIntro}>
            <SurfaceRenderer spec={spec} bindings={bindings} />
          </section>
        ) : (
          <section className={styles.roomHeader}>
            <p>{room.themeLabel ?? "Shared work"}</p>
            <h1>
              {room.otherName} <span>&amp;</span> You
            </h1>
            <div>
              <span>Private room</span>
              <span>Messages stay out of matching</span>
            </div>
          </section>
        )}
        <RoomClient
          room={room}
          initialMessages={messages}
          initialEnhancements={enhancements as unknown as RoomEnhancements}
        />
        <RoomDesignClient roomId={id} />
      </main>
    </>
  );
}
