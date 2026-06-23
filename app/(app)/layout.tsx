import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";

/**
 * Shared layout for all signed-in screens (Home / Favorites / My Favorites).
 *
 * - Authoritative auth gate: redirects to /signin when there's no session
 *   (the edge middleware also runs a cookie-presence check; this is the
 *   server-side authoritative one that catches expired/invalid sessions).
 * - Reserves bottom space (`pb-20`) so page content doesn't sit underneath
 *   the fixed bottom nav.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <>
      <div className="flex flex-1 flex-col pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
