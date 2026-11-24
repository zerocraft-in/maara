import {
  BadgePercent,
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
  channelKey?: string;
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
      leaf("/settings/product-categories", "Product categories", Tag),
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
    href: "/settings/sales-channels?channel=online_store",
    icon: Store,
    section: "Sales channels",
    channelKey: "online_store",
    children: [],
  },
  {
    id: "agentic",
    label: "Agentic",
    href: "/settings/sales-channels?channel=agentic",
    icon: LayoutGrid,
    section: "Sales channels",
    channelKey: "agentic",
    children: [],
  },
  {
    id: "point-of-sale",
    label: "Point of Sale",
    href: "/settings/sales-channels/point-of-sale",
    icon: Receipt,
    section: "Sales channels",
    channelKey: "point_of_sale",
    children: [
      leaf("/settings/sales-channels/point-of-sale/devices", "Devices", Boxes),
      leaf("/settings/sales-channels/point-of-sale/register-sessions", "Register sessions", Receipt),
      leaf("/settings/sales-channels/point-of-sale/settings", "Settings", Settings),
    ],
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
