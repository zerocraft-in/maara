import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  Truck,
  ShoppingCart,
  Receipt,
  Users,
  Wallet,
  ChartNoAxesCombined,
  FileBarChart,
  MapPin,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** A leaf navigation destination. */
export type NavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
};

/**
 * A sidebar navigation group.
 *
 * Groups with a single child render as direct links (no disclosure control).
 * Groups with multiple children render as expandable parent items.
 */
export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavChild[];
};

/** Items anchored below the scrollable navigation list (bottom sidebar). */
export const FOOTER_ITEMS: NavChild[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings.view",
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    children: [
      {
        href: "/overview",
        label: "Overview",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Package,
    children: [
      {
        href: "/products",
        label: "Products",
        icon: Package,
        permission: "products.view",
      },
      {
        href: "/categories",
        label: "Categories",
        icon: Tags,
        permission: "categories.view",
      },
      {
        href: "/inventory",
        label: "Inventory",
        icon: Boxes,
        permission: "inventory.view",
      },
    ],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    icon: Truck,
    children: [
      {
        href: "/suppliers",
        label: "Suppliers",
        icon: Truck,
        permission: "suppliers.view",
      },
      {
        href: "/purchases",
        label: "Purchases",
        icon: ShoppingCart,
        permission: "purchases.view",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: Receipt,
    children: [
      {
        href: "/sales",
        label: "Sales",
        icon: Receipt,
        permission: "sales.view",
      },
      {
        href: "/customers",
        label: "Customers",
        icon: Users,
        permission: "customers.view",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    children: [
      {
        href: "/expenses",
        label: "Expenses",
        icon: Wallet,
        permission: "expenses.view",
      },
      {
        href: "/finance",
        label: "Finance",
        icon: Wallet,
        permission: "finance.view",
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: ChartNoAxesCombined,
    children: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        permission: "analytics.view",
      },
      {
        href: "/reports",
        label: "Reports",
        icon: FileBarChart,
        permission: "reports.view",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: MapPin,
    children: [
      {
        href: "/locations",
        label: "Locations",
        icon: MapPin,
        permission: "locations.view",
      },
      {
        href: "/users",
        label: "Users & Roles",
        icon: ShieldCheck,
        permission: "users.view",
      },
      {
        href: "/audit-logs",
        label: "Audit Logs",
        icon: ShieldCheck,
        permission: "audit_logs.view",
      },
    ],
  },
];

/** Every leaf destination, flattened — used for header titles and the mobile drawer. */
export const FLAT_NAV_ITEMS: NavChild[] = [
  ...NAV_GROUPS.flatMap((g) => g.children),
  ...FOOTER_ITEMS,
];

/** True when `pathname` points at (or under) `href`. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/overview" || href === "/settings") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type DashboardNavItem = NavChild;
