export function SurfaceNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" | "warning" }) {
  return <p className={`lab-notice lab-notice-${tone}`} role="status" aria-live="polite">{children}</p>;
}
