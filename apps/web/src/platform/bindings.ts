import type { D1Like } from "./d1";
import type { R2Like } from "./r2";

export type PlatformBindings = { DB: D1Database & D1Like; ASSETS: R2Bucket & R2Like; BUILDMATES_E2E?: string };

export async function getPlatformBindings(): Promise<PlatformBindings> {
  const runtime = await import("cloudflare:workers");
  return runtime.env as PlatformBindings;
}
