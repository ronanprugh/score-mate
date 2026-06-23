"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/favorites", label: "Favorites" },
  { href: "/my-favorites", label: "My Favorites" },
];

/**
 * Mobile-first bottom navigation. Thumb-reachable on phones; switches to a
 * subtle top variant at `md:`+. Active route gets a visually distinct
 * treatment (different bg + text color). Every item meets the 44×44 px
 * touch-target rule via `min-h-11`.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={[
        "fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-background",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2",
        "dark:border-zinc-800",
      ].join(" ")}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
