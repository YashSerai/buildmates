import { notFound } from "next/navigation";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import RecoveryConsole from "./RecoveryConsole";

export default async function IdempotencyRecoveryPage() {
  const user = await requireUser("/operator/idempotency-recovery");
  const { DB } = await getPlatformBindings();
  const operator = await DB.prepare("SELECT operator_role AS role FROM users WHERE id=? AND status='active' LIMIT 1").bind(user.id).first<{ role: string }>();
  if (operator?.role !== "admin") notFound();
  return <RecoveryConsole />;
}
