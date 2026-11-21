import {
  BadgePercent,
  Box,
  Boxes,
  ChartNoAxesColumn,
  Gauge,
  Globe,
  House,
  Image,
  Inbox,
  LayoutGrid,
  Settings,
  Store,
  Tag,
  Truck,
  Users,
  Package,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
};
export type NavGroup = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  children: NavChild[];
  section?: string;
};
const leaf = (href: string, label: string, icon: LucideIcon): NavChild => ({
  href,
  label,
  icon,
  permission: "dashboard.view",
});

export const NAV_GROUPS: NavGroup[] = [
  { id: "home", label: "Home", href: "/overview", icon: House, children: [] },
  { id: "orders", label: "Orders", href: "/orders", icon: Inbox, children: [] },
  {
    id: "products",
    label: "Products",
    href: "/products",
    icon: Tag,
    children: [
      leaf("/categories", "Collections", Tag),
      leaf("/inventory", "Inventory", Boxes),
      leaf("/purchases", "Purchase orders", Inbox),
      leaf("/transfers", "Transfers", Truck),
      leaf("/gift_cards", "Gift cards", Package),
    ],
  },
  {
    id: "customers",
    label: "Customers",
    href: "/customers",
    icon: Users,
    children: [],
  },
  {
    id: "growth",
    label: "Growth",
    href: "/growth",
    icon: Gauge,
    children: [],
  },
  {
    id: "discounts",
    label: "Discounts",
    href: "/discounts",
    icon: BadgePercent,
    children: [],
  },
  {
    id: "content",
    label: "Content",
    href: "/content/files",
    icon: Image,
    children: [],
  },
  {
    id: "markets",
    label: "Markets",
    href: "/markets",
    icon: Globe,
    children: [],
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: ChartNoAxesColumn,
    children: [],
  },
  {
    id: "online-store",
    label: "Online Store",
    href: "/content/files",
    icon: Store,
    section: "Sales channels",
    children: [],
  },
  {
    id: "agentic",
    label: "Agentic",
    href: "/overview",
    icon: LayoutGrid,
    section: "Sales channels",
    children: [],
  },
  {
    id: "point-of-sale",
    label: "Point of Sale",
    href: "/sales",
    icon: Receipt,
    section: "Sales channels",
    children: [],
  }
];

export const FOOTER_ITEMS: NavChild[] = [
  leaf("/settings", "Settings", Settings),
];
export const FLAT_NAV_ITEMS: NavChild[] = [
  ...NAV_GROUPS.flatMap((group) => group.children),
  ...FOOTER_ITEMS,
];
export type DashboardNavItem = NavChild;
