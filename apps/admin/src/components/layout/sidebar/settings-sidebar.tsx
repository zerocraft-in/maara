"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  UserRound,
  Shield,
  Bell,
  Palette,
  Store,
  MapPin,
  CreditCard,
  ChevronLeft,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_ITEMS = [
  { href: "/settings", label: "General", icon: Building2, exact: true },
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/organization", label: "Organization", icon: Store },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/roles", label: "Roles & Permissions", icon: Shield },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col transition-all duration-300 ease-in-out",
        "border-l border-border",
        open ? "lg:w-60" : "lg:w-14 overflow-hidden",
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((prevOpen: boolean) => !prevOpen)}
        className="absolute -right-1 top-2 z-10 p-1 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
        aria-label="Toggle settings sidebar"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Header section */}
      <div className="flex flex-col gap-1 p-4">
        <h2 className="text-[10px] font-semibold tracking-tighter text-sidebar-foreground/60 uppercase">
          Settings
        </h2>
        <p className="text-[11px] text-sidebar-foreground/50">
          Manage your workspace
        </p>
      </div>

      {/* Navigation list */}
      {open ? (
        <nav className="flex-1 space-y-1 px-2 pb-4">
          {SETTINGS_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <div className="flex items-center justify-center size-6 shrink-0 rounded-sm">
                  <Icon className="size-4 shrink-0" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Bottom section */}
          <div className="mt-auto border-t border-sidebar-border/50 pt-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50">
              <HelpCircle className="size-4 shrink-0" />
              <span className="text-xs font-medium">Help & Support</span>
            </div>
          </div>
        </nav>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1 px-1">
          {SETTINGS_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md p-1.5 transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}
