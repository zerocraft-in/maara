
import type { ReactNode } from "react";

/**
 * Settings page layout.
 *
 * The secondary settings navigation is rendered by the dashboard shell as a
 * fixed column (Shopify Admin model): the global sidebar auto-condenses on
 * /settings routes, the settings nav stays anchored, and only the page
 * content scrolls inside `SidebarInset`.
 */
export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col px-5 py-6 sm:px-8 sm:py-10">
      {children}
    </div>
  );
}