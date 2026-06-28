import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("renders the three destinations in order: Home, Favorites, Settings", () => {
    usePathnameMock.mockReturnValue("/home");
    render(<BottomNav />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent(/home/i);
    expect(links[0]).toHaveAttribute("href", "/home");
    expect(links[1]).toHaveTextContent(/^favorites$/i);
    expect(links[1]).toHaveAttribute("href", "/favorites");
    expect(links[2]).toHaveTextContent(/settings/i);
    expect(links[2]).toHaveAttribute("href", "/settings");
  });

  it("no longer renders a 'My Favorites' destination", () => {
    usePathnameMock.mockReturnValue("/home");
    render(<BottomNav />);
    expect(
      screen.queryByRole("link", { name: /my favorites/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /\/my-favorites/ }),
    ).not.toBeInTheDocument();
  });

  it("renders an inline SVG icon + a text label for every item", () => {
    usePathnameMock.mockReturnValue("/home");
    render(<BottomNav />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("svg")).not.toBeNull();
      // Label text is still present alongside the icon (accessibility).
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("each nav item meets the 44×44 touch-target rule via min-h-11/min-w-11", () => {
    usePathnameMock.mockReturnValue("/home");
    render(<BottomNav />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toMatch(/\bmin-h-11\b/);
      expect(link.className).toMatch(/\bmin-w-11\b/);
    }
  });

  it("marks the active route with aria-current='page' when pathname matches exactly", () => {
    usePathnameMock.mockReturnValue("/settings");
    render(<BottomNav />);
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: /^favorites$/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the active route when pathname is a sub-path (e.g. /favorites/123)", () => {
    usePathnameMock.mockReturnValue("/favorites/abc");
    render(<BottomNav />);
    const favLink = screen.getByRole("link", { name: /^favorites$/i });
    expect(favLink).toHaveAttribute("aria-current", "page");
  });

  it("active item gets a visually distinct class (bg-foreground text-background)", () => {
    usePathnameMock.mockReturnValue("/favorites");
    render(<BottomNav />);
    const active = screen.getByRole("link", { name: /^favorites$/i });
    expect(active.className).toMatch(/\bbg-foreground\b/);
    expect(active.className).toMatch(/\btext-background\b/);
  });
});
