"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SettingsPageHeader } from "./settings-page-header";

const PAGE_HEADERS: Record<
  string,
  { title: string; description?: string; eyebrow?: string }
> = {
  "/settings": {
    title: "General",
    description:
      "Business entity used for financial products, markets, apps, and taxes in this shop",
  },
  "/settings/general": {
    title: "General",
    description:
      "Business entity used for financial products, markets, apps, and taxes in this shop",
  },
  "/settings/general/store-contact-details": {
    title: "Store contact details",
    eyebrow: "General",
  },
  "/settings/appearance": {
    title: "Appearance",
    description: "Customize the look and feel of your workspace",
  },
};

function fallbackTitle(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).pop() ?? "settings";
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SettingsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const header = PAGE_HEADERS[pathname] ?? { title: fallbackTitle(pathname) };

  return (
    <div className="relative min-w-0">
      <SettingsPageHeader {...header} />
      {children}
    </div>
  );
}
