import type { ReactNode } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./settings-shell.module.css";

type SettingsSection = "privacy" | "automation" | "connections" | "safety";

const sections: Array<{
  id: SettingsSection;
  href: string;
  label: string;
}> = [
  { id: "privacy", href: "/settings/privacy", label: "Profile & privacy" },
  {
    id: "automation",
    href: "/settings/automation",
    label: "Networking & Work Pulse",
  },
  {
    id: "connections",
    href: "/settings/connections",
    label: "Codex connection",
  },
  { id: "safety", href: "/settings/safety", label: "Safety" },
];

export function SettingsShell({
  current,
  eyebrow,
  title,
  description,
  children,
}: {
  current: SettingsSection;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.page}>
        <section className={styles.intro} aria-labelledby="settings-title">
          <p>{eyebrow}</p>
          <h1 id="settings-title">{title}</h1>
          <span>{description}</span>
        </section>
        <nav className={styles.nav} aria-label="Settings sections">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              aria-current={current === section.id ? "page" : undefined}
            >
              {section.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </>
  );
}
