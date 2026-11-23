export type Address = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
};

export type CustomerRow = {
  id: string;
  organization_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  note: string | null;
  tags: string[];
  tax_exempt: boolean;
  accepts_marketing: boolean;
  marketing_opt_in_level: string;
  state: string;
  verified_email: boolean;
  default_address: Address | null;
  addresses: Address[];
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
  name: string;
};

export type CustomerFilter =
  | "all"
  | "enabled"
  | "disabled"
  | "invited"
  | "declined";

export type CustomerSortField =
  | "name"
  | "email"
  | "orders_count"
  | "total_spent"
  | "last_order_at"
  | "created_at";

export type CustomerFormInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  note: string;
  tags: string[];
  tax_exempt: boolean;
  accepts_marketing: boolean;
  marketing_opt_in_level: string;
  state: string;
  default_address: Address | null;
  addresses: Address[];
};

export function customerDisplayName(customer: CustomerRow): string {
  if (customer.first_name || customer.last_name) {
    return `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  }
  return customer.email ?? "—";
}

export function initials(customer: CustomerRow): string {
  const first = customer.first_name?.charAt(0) ?? "";
  const last = customer.last_name?.charAt(0) ?? "";
  return (first + last).toUpperCase() || "?";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function stateLabel(state: string): string {
  switch (state) {
    case "enabled":
      return "Active";
    case "disabled":
      return "Disabled";
    case "invited":
      return "Invited";
    case "declined":
      return "Declined";
    default:
      return state;
  }
}

export function marketingLabel(level: string): string {
  switch (level) {
    case "confirmed_opt_in":
      return "Confirmed opt-in";
    case "single_opt_in":
      return "Single opt-in";
    case "unconfirmed_opt_in":
      return "Unconfirmed opt-in";
    case "unknown":
    default:
      return "Unknown";
  }
}
