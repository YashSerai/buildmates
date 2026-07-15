import type { Metadata } from "next";
import { requireUser } from "../../src/auth/require-user";
import { SurfaceLabClient } from "./SurfaceLabClient";

export const metadata: Metadata = { title: "Surface lab · Buildmates", robots: { index: false, follow: false } };

export default async function SurfaceLabPage() {
  await requireUser("/surface-lab");
  return <SurfaceLabClient />;
}
