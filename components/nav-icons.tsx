/**
 * Inline outline SVG icons for the bottom navigation. Each inherits
 * `currentColor` and is `aria-hidden` (the nav `<Link>` keeps its text label
 * for accessibility). No icon-library dependency.
 */

type IconProps = { className?: string };

const BASE = "h-6 w-6 shrink-0";

function svgProps(className?: string) {
  return {
    className: [BASE, className].filter(Boolean).join(" "),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** House — Home. */
export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

/** Star — Favorites. */
export function FavoritesIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 4l2.5 5.1 5.6.8-4 4 1 5.6L12 16.9 6.9 19.5l1-5.6-4-4 5.6-.8L12 4z" />
    </svg>
  );
}

/** People — Teams. */
export function TeamsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17 13.4a5.5 5.5 0 0 1 3.5 5.1V19" />
    </svg>
  );
}

/** Sliders — Settings. */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 8h16M4 16h16" />
      <circle cx="15" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </svg>
  );
}
