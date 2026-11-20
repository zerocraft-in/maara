"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgePercent,
  Bell,
  Boxes,
  ChevronLeft,
  CircleDollarSign,
  CreditCard,
  FileText,
  Globe2,
  Languages,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  Network,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsItem = { href: string; label: string; icon: LucideIcon };
const ORGANIZATION_ITEMS: SettingsItem[] = [
  {
    href: "/settings/organization-details",
    label: "Organization",
    icon: Settings2,
  },
  { href: "/settings/users", label: "Users", icon: Users },
  { href: "/settings/payouts", label: "Payouts", icon: WalletCards },
  {
    href: "/settings/partner-billing",
    label: "Partner billing",
    icon: Receipt,
  },
];
const STORE_ITEMS: SettingsItem[] = [
  { href: "/settings", label: "General", icon: Store },
  { href: "/settings/plan", label: "Plan", icon: CreditCard },
  { href: "/settings/billing", label: "Billing", icon: Receipt },
  { href: "/settings/payments", label: "Payments", icon: CircleDollarSign },
  { href: "/settings/checkout", label: "Checkout", icon: ShoppingBag },
  {
    href: "/settings/customer-accounts",
    label: "Customer accounts",
    icon: UserRound,
  },
  {
    href: "/settings/shipping-and-delivery",
    label: "Shipping and delivery",
    icon: Truck,
  },
  {
    href: "/settings/taxes-and-duties",
    label: "Taxes and duties",
    icon: BadgePercent,
  },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/apps", label: "Apps", icon: LayoutGrid },
  { href: "/settings/sales-channels", label: "Sales channels", icon: Network },
  { href: "/settings/domains", label: "Domains", icon: Globe2 },
  {
    href: "/settings/customer-events",
    label: "Customer events",
    icon: ShieldCheck,
  },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  {
    href: "/settings/metafields-and-metaobjects",
    label: "Metafields and metaobjects",
    icon: Boxes,
  },
  { href: "/settings/languages", label: "Languages", icon: Languages },
  {
    href: "/settings/customer-privacy",
    label: "Customer privacy",
    icon: LockKeyhole,
  },
  { href: "/settings/policies", label: "Policies", icon: FileText },
];

export function SettingsSidebar({
  user,
  organizationName = "Organization",
  storeName = "MAARA MERCH+",
}: {
  user?: { name?: string | null; email?: string | null } | null;
  organizationName?: string;
  storeName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = user?.name?.trim() || "User";
  const displayEmail = user?.email?.trim() || "";
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const goBack = () => {
    const previous =
      window.sessionStorage.getItem("maara-last-store-route") || "/";
    router.push(previous.startsWith("/settings") ? "/" : previous);
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 border-b border-sidebar-border px-3 py-3">
        <button
          type="button"
          onClick={goBack}
          className="flex h-7 items-center gap-2 text-sm font-semibold text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ChevronLeft className="size-4" />
          Settings
        </button>
        <label className="relative mt-3 block">
          <span className="sr-only">Search settings</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-muted" />
          <input
            placeholder="Search settings"
            className="h-8 w-full rounded-lg border border-sidebar-border bg-sidebar-hover pl-8 pr-2 text-[13px] outline-none placeholder:text-sidebar-muted focus:border-sidebar-muted focus:ring-2 focus:ring-sidebar-ring"
          />
        </label>
      </div>
      <nav
        aria-label="Settings"
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3"
      >
        <section className="px-2 pb-2">
          <div className="text-[13px] font-semibold">{organizationName}</div>
          <div className="text-[12px] text-sidebar-muted">Organization</div>
        </section>
        {ORGANIZATION_ITEMS.map((item) => (
          <SettingsLink
            key={item.href}
            item={item}
            active={active(item.href)}
          />
        ))}
        <div className="my-3 border-t border-sidebar-border" />
        <section className="flex items-center justify-between px-2 pb-2">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{storeName}</div>
            <div className="truncate text-[12px] text-sidebar-muted">
              {storeName.toLowerCase().replaceAll(" ", "")}.myshopify.com
            </div>
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-avatar text-[10px] font-semibold text-black">
            MAR
          </span>
        </section>
        {STORE_ITEMS.map((item) => (
          <SettingsLink
            key={item.href}
            item={item}
            active={active(item.href)}
          />
        ))}
      </nav>
      <footer className="flex shrink-0 items-center gap-2 border-t border-sidebar-border px-3 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-black">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">
            {displayName}
          </div>
          <div className="truncate text-[12px] text-sidebar-muted">
            {displayEmail}
          </div>
        </div>
      </footer>
    </aside>
  );
}

function SettingsLink({
  item,
  active,
}: {
  item: SettingsItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        active
          ? "bg-sidebar-accent font-semibold text-white"
          : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
      )}
    >
      <Icon className="size-4 shrink-0 text-sidebar-muted" />
      {item.label}
    </Link>
  );
}
