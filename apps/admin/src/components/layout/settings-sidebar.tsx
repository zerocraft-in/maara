"use client";

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

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <div className="mb-4">
        <h2 className="text-xs font-semibold tracking-tighter text-muted-foreground uppercase">
          Settings
        </h2>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Manage your workspace
        </p>
      </div>

      <nav className="space-y-0.5">
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
                "flex h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}