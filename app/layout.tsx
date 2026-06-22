import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScoreMate",
  description:
    "Your favorite teams, leagues, sports, and tournaments — yesterday, today, and tomorrow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
