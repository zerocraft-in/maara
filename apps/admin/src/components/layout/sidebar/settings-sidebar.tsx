"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Layout,
  List,
  DollarSign,
  CreditCard,
  ShoppingCart,
  Users,
  Truck,
  FileText,
  MapPin,
  Grid,
  Share2,
  Link as LinkIcon,
  Sparkles,
  Bell,
  Package,
  Globe,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_ITEMS = [
  { href: "/settings", label: "General", icon: Layout, exact: true },
  { href: "/settings/plan", label: "Plan", icon: List },
  { href: "/settings/billing", label: "Billing", icon: DollarSign },
  { href: "/settings/payments", label: "Payments", icon: CreditCard },
  { href: "/settings/checkout", label: "Checkout", icon: ShoppingCart },
  {
    href: "/settings/customer-accounts",
    label: "Customer accounts",
    icon: Users,
  },
  {
    href: "/settings/shipping-and-delivery",
    label: "Shipping and delivery",
    icon: Truck,
  },
  {
    href: "/settings/taxes-and-duties",
    label: "Taxes and duties",
    icon: FileText,
  },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/apps", label: "Apps", icon: Grid },
  { href: "/settings/sales-channels", label: "Sales channels", icon: Share2 },
  { href: "/settings/domains", label: "Domains", icon: LinkIcon },
  {
    href: "/settings/customer-events",
    label: "Customer events",
    icon: Sparkles,
  },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  {
    href: "/settings/metafields-and-metaobjects",
    label: "Metafields and metaobjects",
    icon: Package,
  },
  { href: "/settings/languages", label: "Languages", icon: Globe },
  {
    href: "/settings/customer-privacy",
    label: "Customer privacy",
    icon: Shield,
  },
  { href: "/settings/policies", label: "Policies", icon: FileText },
  {
    href: "/settings/organization-details",
    label: "Organization details",
    icon: Shield,
  },
  {
    href: "/settings/organization-account",
    label: "Organization account",
    icon: Users,
  },
];

export function SettingsSidebar({
  user,
}: {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  const displayName = user?.name?.trim() || "User";
  const displayEmail = user?.email?.trim() || "";
  const avatarUrl = user?.avatar?.trim() || null;

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
        <button
          onClick={router.back}
          className="flex items-center gap-2 min-w-0 text-sidebar-foreground hover:text-sidebar-foreground transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="size-5 shrink-0" />
          <span className="relative flex items-center justify-center min-w-0">
            <span className="w-full overflow-hidden h-[1.2em]">
              <motion.span
                initial={{ y: 0 }}
                whileHover={{ y: "-50%" }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="grid grid-rows-2 w-full items-center justify-center text-start text-xs font-semibold tracking-tighter"
              >
                <span>Settings</span>
                <span>Back</span>
              </motion.span>
            </span>
          </span>
        </button>
      </div>

      {/* Navigation list */}
      {open ? (
        <nav className="flex-1 space-y-0.5 px-2 pb-4">
          {SETTINGS_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
                )}
              >
                <div className="flex items-center justify-center size-6 shrink-0 rounded-sm">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active && "text-sidebar-accent-foreground",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active && "text-sidebar-accent-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Bottom section - user profile */}
          <div className="mt-auto border-t border-sidebar-border/50 pt-3 pb-2">
            <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm">
              <div className="flex shrink-0 items-center justify-center mt-1">
                <span className="text-muted-foreground/50">|</span>
              </div>
              <div className="min-w-0 flex flex-col leading-none">
                <span className="text-xs font-semibold truncate">{displayName}</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {displayEmail}
                </span>
              </div>
            </div>
          </div>
        </nav>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1 px-1">
          {SETTINGS_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
