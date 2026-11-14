"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/inventory", label: "Inventory" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/purchases", label: "Purchases" },
  { href: "/sales", label: "Sales" },
  { href: "/customers", label: "Customers" },
  { href: "/expenses", label: "Expenses" },
  { href: "/finance", label: "Finance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/reports", label: "Reports" },
  { href: "/locations", label: "Locations" },
  { href: "/users", label: "Users & Roles" },
  { href: "/audit-logs", label: "Audit Logs" },
  { href: "/settings", label: "Settings" },
] as const;

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [user, setUser] = React.useState<{
    email: string | null;
    organization: string | null;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser({
          email: data.session.user.email ?? null,
          organization: null, // resolved server-side; shown as placeholder
        });
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (session) {
        setUser({
          email: session.user.email ?? null,
          organization: null,
        });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors closeButton />

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-border bg-surface text-foreground transition-all duration-300 hidden sm:flex",
          sidebarOpen ? "w-[260px]" : "w-[72px]"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-[12px] font-bold text-brand-fg"
            >
              M
            </div>
            {sidebarOpen && (
              <p className="text-sm font-semibold tracking-[-0.02em]">
                Maara Merch
              </p>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
            className="flex size-8 items-center justify-center rounded-md text-meta hover:bg-inset"
          >
            <span className="sr-only">Toggle sidebar</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              {sidebarOpen ? (
                <>
                  <path d="M5 12h14" />
                  <path d="m19 7-5 5 5 5" />
                </>
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn("size-4 shrink-0", isActive ? "text-accent-foreground" : "text-sidebar-foreground")}
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6M12 18v6M4.22 4.22l5.66 5.66M18.34 18.34l5.66 5.66M2 12h6M18 12h6M4.22 19.78l5.66-5.66M18.34 5.66l5.66-5.66" />
                </svg>
                {sidebarOpen ? (
                  <span>{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-900 rounded shadow-md whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-2 py-2 text-xs text-sidebar-foreground">
            <div className="size-6 rounded-full bg-inset flex items-center justify-center">
              {user?.email ? user.email.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-semibold leading-none">{user?.email || "User"}</p>
              {user?.organization && (
                <p className="text-[10px] text-meta leading-none">{user.organization}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full mt-2 text-xs"
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileDrawerOpen((prev) => !prev)}
              aria-label="Toggle menu"
              className="flex size-8 items-center justify-center rounded-md text-meta hover:bg-inset sm:hidden"
            >
              <span className="sr-only">Toggle menu</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold tracking-[-0.01em]">
              {NAV_ITEMS.find((item) => item.href === pathname)?.label || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 max-w-[1400px]">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/40 sm:hidden"
            onClick={() => setMobileDrawerOpen(false)}
          />
         <aside
  className={cn(
    "fixed inset-y-0 left-0 z-30 w-[260px] bg-surface border-r border-border shadow-lg sm:hidden"
  )}
>
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2">
                <div
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-[12px] font-bold text-brand-fg"
                >
                  M
                </div>
                <p className="text-sm font-semibold tracking-[-0.02em]">
                  Maara Merch
                </p>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-md text-meta hover:bg-inset"
              >
                <span className="sr-only">Close menu</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setMobileDrawerOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "size-4 shrink-0",
                        isActive
                          ? "text-accent-foreground"
                          : "text-sidebar-foreground"
                      )}
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v6M12 18v6M4.22 4.22l5.66 5.66M18.34 18.34l5.66 5.66M2 12h6M18 12h6M4.22 19.78l5.66-5.66M18.34 5.66l5.66-5.66" />
                    </svg>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-3 px-2 py-2 text-xs text-sidebar-foreground">
                <div className="size-6 rounded-full bg-inset flex items-center justify-center">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex flex-col">
                  <p className="text-xs font-semibold leading-none">
                    {user?.email || "User"}
                  </p>
                  {user?.organization && (
                    <p className="text-[10px] text-meta leading-none">
                      {user?.organization}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleLogout();
                  setMobileDrawerOpen(false);
                }}
                className="w-full mt-2 text-xs"
              >
                Logout
              </Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
