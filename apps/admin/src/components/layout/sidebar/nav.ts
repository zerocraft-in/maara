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
  File,
  TrendingUp,
  BadgePercent,
  Globe2,
  Store,
  AppWindow,
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
  section?: string;
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
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    children: [
      {
        href: "/overview",
        label: "Home",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: Receipt,
    children: [
      {
        href: "/sales",
        label: "Orders",
        icon: Receipt,
        permission: "sales.view",
      },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    children: [
      {
        href: "/categories",
        label: "Collections",
        icon: Tags,
        permission: "categories.view",
      },
      {
        href: "/inventory",
        label: "Inventory",
        icon: Boxes,
        permission: "inventory.view",
      },
      {
        href: "/purchases",
        label: "Purchase orders",
        icon: ShoppingCart,
        permission: "purchases.view",
      },
      {
        href: "/locations",
        label: "Transfers",
        icon: Truck,
        permission: "locations.view",
      },
      {
        href: "/products",
        label: "Gift cards",
        icon: Package,
        permission: "products.view",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    children: [
      {
        href: "/customers",
        label: "Customers",
        icon: Users,
        permission: "customers.view",
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: TrendingUp,
    children: [
      {
        href: "/analytics",
        label: "Growth",
        icon: TrendingUp,
        permission: "analytics.view",
      },
    ],
  },
  {
    id: "discounts",
    label: "Discounts",
    icon: BadgePercent,
    children: [
      {
        href: "/reports",
        label: "Discounts",
        icon: BadgePercent,
        permission: "reports.view",
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: File,
    children: [
      {
        href: "/content/files",
        label: "Content",
        icon: File,
        permission: "media.view",
      },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    icon: Globe2,
    children: [
      {
        href: "/finance",
        label: "Markets",
        icon: Globe2,
        permission: "finance.view",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    children: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        permission: "analytics.view",
      },
    ],
  },
  {
    id: "online-store",
    label: "Online Store",
    icon: Store,
    section: "Sales channels",
    children: [{ href: "/content/files", label: "Online Store", icon: Store, permission: "media.view" }],
  },
  {
    id: "agentic",
    label: "Agentic",
    icon: AppWindow,
    children: [{ href: "/overview", label: "Agentic", icon: AppWindow, permission: "dashboard.view" }],
  },
  {
    id: "point-of-sale",
    label: "Point of Sale",
    icon: Receipt,
    children: [{ href: "/sales", label: "Point of Sale", icon: Receipt, permission: "sales.view" }],
  },
  {
    id: "checkout-blocks",
    label: "Checkout Blocks",
    icon: AppWindow,
    section: "Apps",
    children: [{ href: "/products", label: "Checkout Blocks", icon: AppWindow, permission: "products.view" }],
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
