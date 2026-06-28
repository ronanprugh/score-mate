"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { HomeIcon, FavoritesIcon, SettingsIcon } from "./nav-icons";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/favorites", label: "Favorites", Icon: FavoritesIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

/**
 * Mobile-first bottom navigation. Three thumb-reachable destinations, each an
 * inline-SVG icon above its label. Active route gets a visually distinct
 * treatment (different bg + text color) and `aria-current="page"`; nested
 * routes (e.g. `/favorites/123`) keep their tab active. Every item meets the
 * 44×44 px touch-target rule via `min-h-11`/`min-w-11`.
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
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs font-medium",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
