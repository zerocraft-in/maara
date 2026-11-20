"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_ITEMS = [
  { href: "/settings/general", label: "General", exact: true },
  { href: "/settings/plan", label: "Plan" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/payments", label: "Payments" },
  { href: "/settings/checkout", label: "Checkout" },
  { href: "/settings/customer-accounts", label: "Customer accounts" },
  { href: "/settings/shipping-and-delivery", label: "Shipping and delivery" },
  { href: "/settings/taxes-and-duties", label: "Taxes and duties" },
  { href: "/settings/locations", label: "Locations" },
  { href: "/settings/apps", label: "Apps" },
  { href: "/settings/sales-channels", label: "Sales channels" },
  { href: "/settings/domains", label: "Domains" },
  { href: "/settings/customer-events", label: "Customer events" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/metafields-and-metaobjects", label: "Metafields and metaobjects" },
  { href: "/settings/languages", label: "Languages" },
  { href: "/settings/customer-privacy", label: "Customer privacy" },
  { href: "/settings/policies", label: "Policies" },
  { href: "/settings/organization-details", label: "Organization details" },
  { href: "/settings/organization-account", label: "Organization account" },
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
  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col transition-all duration-300 ease-in-out",
        "border-r border-[#303030] bg-[#0a0a0a] text-[#dcdcdc]",
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
      <div className="flex flex-col gap-2 border-b border-[#303030] px-3 py-3">
        <button
          onClick={router.back}
          className="flex min-h-7 items-center gap-2 text-left text-[13px] font-medium text-[#f7f7f7]"
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
        <div className="px-2 text-[12px] font-medium text-[#a7a7a7]">Shop settings</div>
        <label className="relative block">
          <span className="sr-only">Search settings</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#a7a7a7]" />
          <input className="h-8 w-full rounded-lg border border-[#454545] bg-[#1a1a1a] pl-8 pr-2 text-[13px] text-white outline-none placeholder:text-[#a7a7a7] focus:border-[#8c8c8c]" placeholder="Search settings" />
        </label>
      </div>

      {/* Navigation list */}
      {open ? (
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 pb-4">
          {SETTINGS_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-7 items-center rounded-lg px-4 text-[13px] leading-5 transition-colors",
                  active
                    ? "bg-[#303030] text-[#fcfcfc]"
                    : "text-[#dcdcdc] hover:bg-[#1f1f1f] hover:text-white",
                )}
              >
                <span className="truncate">{item.label}</span>
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
                <span className="text-xs font-semibold truncate text-primary-foreground">{displayName}</span>
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

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md p-1.5 transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary-accent-foreground"
                    : "text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}
