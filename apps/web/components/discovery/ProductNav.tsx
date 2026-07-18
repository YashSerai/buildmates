"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ProductNavItem = { href: string; label: string };

export function ProductNavLinks({ items }: { items: ProductNavItem[] }) {
  const pathname = usePathname();
  return items.map((item) => {
    const current =
      pathname === item.href ||
      (item.href !== "/home" && pathname.startsWith(`${item.href}/`)) ||
      (item.href === "/connections" && pathname.startsWith("/rooms/")) ||
      (item.href === "/settings/privacy" && pathname.startsWith("/settings/"));
    return (
      <Link href={item.href} aria-current={current ? "page" : undefined} key={item.href}>
        {item.label}
      </Link>
    );
  });
}
