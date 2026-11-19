import type { ReactNode } from "react";
import { SettingsDirtyProvider } from "./dirty-provider";
import { SettingsLayoutClient } from "./settings-layout-client";

/**
 * Settings page layout.
 *
 * The secondary settings navigation is rendered by the dashboard shell as a
 * fixed column (Shopify Admin model): the global sidebar auto-condenses on
 * /settings routes, the settings nav stays anchored, and only the page
 * content scrolls inside `SidebarInset`.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsDirtyProvider>
      <div className="mx-auto flex w-full min-w-0 flex-col">
        <SettingsLayoutClient>{children}</SettingsLayoutClient>
      </div>
    </SettingsDirtyProvider>
  );
}
