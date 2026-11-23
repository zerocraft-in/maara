"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus, MoreHorizontal, ChevronLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Archive, Check, Eye, Phone, Mail, Tag, Clock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/app/(dashboard)/products/_components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CustomerRow,
  CustomerFilter,
  CustomerSortField,
  customerDisplayName,
  initials,
  formatCurrency,
  stateLabel,
  marketingLabel,
} from "../types";
import {
  archiveCustomer,
  enableCustomer,
} from "../actions";
import { Separator } from "@/components/ui/separator";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

type SortDirection = "asc" | "desc";

interface CustomersManagerProps {
  organizationId: string;
  permissions: Set<string>;
}

export default function CustomersManager({
  organizationId,
  permissions,
}: CustomersManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canCreate = permissions.has("customers.manage");
  const canUpdate = permissions.has("customers.manage");
  const canArchive = permissions.has("customers.manage");

  // ---- URL-synced filter state ----
  const [searchQuery, setSearchQuery] = React.useState(
    () => searchParams.get("q") ?? ""
  );
  const [stateFilter, setStateFilter] = React.useState<CustomerFilter>(
    () => (searchParams.get("state") ?? "all") as CustomerFilter
  );
  const [pageIndex, setPageIndex] = React.useState(() => {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    return page - 1;
  });
  const [pageSize, setPageSize] = React.useState(() => {
    const size = Number(searchParams.get("page_size")) || DEFAULT_PAGE_SIZE;
    return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
  });
  const [sortField, setSortField] = React.useState<CustomerSortField>(() => {
    const valid: CustomerSortField[] = [
      "name", "email", "orders_count", "total_spent", "last_order_at", "created_at",
    ];
    const raw = (searchParams.get("sort") ?? "created_at") as CustomerSortField;
    return valid.includes(raw) ? raw : "created_at";
  });
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(() =>
    searchParams.get("dir") === "asc" ? "asc" : "desc"
  );

  const [hiddenColumnIds, setHiddenColumnIds] = React.useState<string[]>([]);

  // Push filter/sort/pagination state to the URL without scrolling.
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (stateFilter && stateFilter !== "all") params.set("state", stateFilter);
    params.set("page", String(pageIndex + 1));
    params.set("page_size", String(pageSize));
    params.set("sort", sortField);
    params.set("dir", sortDirection);
    const href = `${pathname}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (href !== current) {
      router.push(href, { scroll: false });
    }
  }, [
    searchQuery, stateFilter, pageIndex, pageSize, sortField, sortDirection, pathname, router,
  ]);

  // ---- Fetch customers ----
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/customers?organization_id=${organizationId}` +
          `&q=${encodeURIComponent(searchQuery)}` +
          `&state=${encodeURIComponent(stateFilter)}` +
          `&page=${pageIndex + 1}` +
          `&page_size=${pageSize}` +
          `&sort=${sortField}` +
          `&dir=${sortDirection}`
        );
        if (!response.ok) throw new Error("Failed to load customers");
        const data = await response.json();
        setCustomers(data.customers);
        setTotal(data.total ?? 0);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load customers",
        );
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, [organizationId, searchQuery, stateFilter, pageIndex, pageSize, sortField, sortDirection]);

  // ---- Row selection ----
  const [selectedCustomerIds, setSelectedCustomerIds] = React.useState<Set<string>>(new Set());

  const isSelected = (id: string) => selectedCustomerIds.has(id);
  const someSelected = selectedCustomerIds.size > 0 && selectedCustomerIds.size < customers.length;
  const allSelected = customers.length > 0 && selectedCustomerIds.size === customers.length;

  const handleSelectCustomer = (id: string, checked: boolean) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds(new Set(customers.map((c) => c.id)));
    } else {
      setSelectedCustomerIds(new Set());
    }
  };

  const handleClearSelection = () => setSelectedCustomerIds(new Set());

  // ---- Actions ----
  const handleArchive = async (customerId: string, customerName: string) => {
    if (!window.confirm(`Disable customer "${customerName}"? This cannot be undone from the UI.`)) return;

    try {
      const result = await archiveCustomer({ id: customerId });
      if (result.ok) {
        toast.add({ title: "Customer disabled.", type: "success" });
        router.refresh();
      } else {
        toast.add({ title: result.error, type: "error" });
      }
    } catch {
      toast.add({ title: "Failed to disable customer.", type: "error" });
    }
  };

  const handleEnable = async (customerId: string, customerName: string) => {
    try {
      const result = await enableCustomer({ id: customerId });
      if (result.ok) {
        toast.add({ title: "Customer enabled.", type: "success" });
        router.refresh();
      } else {
        toast.add({ title: result.error, type: "error" });
      }
    } catch {
      toast.add({ title: "Failed to enable customer.", type: "error" });
    }
  };

  // ---- Columns ----
  const columnsCtx = {
    canUpdate,
    canArchive,
    onView: (id: string) => router.push(`/customers/${id}`),
    onEdit: (id: string) => router.push(`/customers/${id}`),
    onArchive: handleArchive,
    onEnable: handleEnable,
    onSelect: handleSelectCustomer,
    onSelectAll: handleSelectAll,
    isSelected,
    allSelected,
    someSelected,
  };

  const allColumns = buildColumns(columnsCtx);
  const columns = allColumns.filter(
    (c) => c.id && !hiddenColumnIds.includes(c.id),
  );

  const tableColumns: ColumnDef<CustomerRow, unknown>[] = columns as ColumnDef<CustomerRow, unknown>[];
  const sorting = [{ id: sortField, desc: sortDirection === "desc" }];
  const pagination = { pageIndex, pageSize };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-body">{error}</p>
            <Button onClick={() => router.refresh()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Empty state ----
  if (customers.length === 0 && !loading && !error) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-2.5">
          <Card className="overflow-hidden space-y-0! py-0! gap-0">
            <CardHeader className="p-1.5!">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" className="gap-2">
                        <Filter className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuCheckboxItem
                      key="state"
                      label="Customer state"
                      checked={!hiddenColumnIds.includes("state")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("state")
                            ? prev.filter((id) => id !== "state")
                            : [...prev, "state"],
                        );
                      }}
                    />
                    <Separator />
                    <DropdownMenuCheckboxItem
                      key="tags"
                      label="Tags"
                      checked={!hiddenColumnIds.includes("tags")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("tags")
                            ? prev.filter((id) => id !== "tags")
                            : [...prev, "tags"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="orders"
                      label="Orders"
                      checked={!hiddenColumnIds.includes("orders")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("orders")
                            ? prev.filter((id) => id !== "orders")
                            : [...prev, "orders"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="total_spent"
                      label="Total spent"
                      checked={!hiddenColumnIds.includes("total_spent")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("total_spent")
                            ? prev.filter((id) => id !== "total_spent")
                            : [...prev, "total_spent"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="last_order"
                      label="Last order"
                      checked={!hiddenColumnIds.includes("last_order")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("last_order")
                            ? prev.filter((id) => id !== "last_order")
                            : [...prev, "last_order"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="created_at"
                      label="Created date"
                      checked={!hiddenColumnIds.includes("created_at")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("created_at")
                            ? prev.filter((id) => id !== "created_at")
                            : [...prev, "created_at"],
                        );
                      }}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
          </Card>
        </div>

        <Card className="overflow-hidden space-y-0! py-0! gap-0">
          <CardContent className="overflow-x-auto px-0 py-0">
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MoreHorizontal className="size-12 text-muted-foreground/50" />
                </EmptyMedia>
                <EmptyTitle>No customers found</EmptyTitle>
                <EmptyDescription>
                  {searchQuery || stateFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Get started by adding your first customer."}
                </EmptyDescription>
              </EmptyHeader>
              {canCreate && !searchQuery && stateFilter === "all" && (
                <EmptyContent>
                  <Button onClick={() => router.push("/customers/new")}>
                    <Plus className="size-4 mr-2" />
                    Add customer
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Bulk toolbar ----
  const bulkToolbar = (
    <div className="flex h-9 items-center gap-2 space-y-0">
      <span className="text-xs font-medium text-muted-foreground">
        {selectedCustomerIds.size} customer(s) selected
      </span>
      <Button
        size="sm"
        onClick={() => {
          const firstId = selectedCustomerIds.values().next().value;
          if (firstId) router.push(`/customers/${firstId}`);
        }}
        disabled={selectedCustomerIds.size !== 1}
      >
        <Eye className="size-4 mr-2" />
        View
      </Button>
      <Button size="sm" onClick={handleClearSelection}>
        Clear selection
      </Button>
    </div>
  );

  return (
    <div className="relative mx-auto flex flex-col px-4 py-10 space-y-6">
      <div className="flex flex-col gap-2.5">
        <Card className="overflow-hidden space-y-0! py-0! gap-0">
          <CardHeader className="p-1.5!">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Select
                value={stateFilter}
                onValueChange={(v) => setStateFilter(v as CustomerFilter)}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" className="gap-2">
                        <Filter className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuCheckboxItem
                      key="state"
                      label="Customer state"
                      checked={!hiddenColumnIds.includes("state")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("state")
                            ? prev.filter((id) => id !== "state")
                            : [...prev, "state"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="tags"
                      label="Tags"
                      checked={!hiddenColumnIds.includes("tags")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("tags")
                            ? prev.filter((id) => id !== "tags")
                            : [...prev, "tags"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="orders"
                      label="Orders"
                      checked={!hiddenColumnIds.includes("orders")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("orders")
                            ? prev.filter((id) => id !== "orders")
                            : [...prev, "orders"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="total_spent"
                      label="Total spent"
                      checked={!hiddenColumnIds.includes("total_spent")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("total_spent")
                            ? prev.filter((id) => id !== "total_spent")
                            : [...prev, "total_spent"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="last_order"
                      label="Last order"
                      checked={!hiddenColumnIds.includes("last_order")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("last_order")
                            ? prev.filter((id) => id !== "last_order")
                            : [...prev, "last_order"],
                        );
                      }}
                    />
                    <DropdownMenuCheckboxItem
                      key="created_at"
                      label="Created date"
                      checked={!hiddenColumnIds.includes("created_at")}
                      onCheckedChange={() => {
                        setHiddenColumnIds((prev) =>
                          hiddenColumnIds.includes("created_at")
                            ? prev.filter((id) => id !== "created_at")
                            : [...prev, "created_at"],
                        );
                      }}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                {canCreate && (
                  <Button
                    size="sm"
                    render={<Link href="/customers/new" />}
                  >
                    <Plus className="size-4 mr-2" />
                    Add customer
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Customers Table */}
        <Card className="overflow-hidden space-y-0! py-0! gap-0">
          <CardContent className="overflow-x-auto px-0 py-0">
            <DataTable
              columns={tableColumns}
              data={customers}
              sorting={sorting}
              onSortingChange={(sorting) => {
                const [s] = sorting;
                if (!s) return;
                setSortField(
                  ["name", "email", "orders_count", "total_spent", "last_order_at", "created_at"].includes(s.id)
                    ? (s.id as CustomerSortField)
                    : "created_at",
                );
                setSortDirection(s.desc ? "desc" : "asc");
              }}
              pagination={pagination}
              onPaginationChange={(next) => {
                setPageIndex(next.pageIndex);
                setPageSize(next.pageSize);
              }}
              toolbar={selectedCustomerIds.size > 0 ? bulkToolbar : undefined}
              className="overflow-x-auto"
              selectedCustomers={selectedCustomerIds}
              emptyState={null}
            />
          </CardContent>

          <CardFooter>
            {total > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {Math.min(pageIndex * pageSize + 1, total)}
                    -{" "}
                    {Math.min((pageIndex + 1) * pageSize, total)}
                    of {total}
                  </span>
                </div>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Column definitions
// ============================================================================

type CustomerColumnCtx = {
  canUpdate: boolean;
  canArchive: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string, name: string) => void;
  onEnable: (id: string, name: string) => void;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  someSelected: boolean;
};

type TableCellCtx<TData> = { row: { original: TData } };
type TableHeaderCtx = { table: { getColumn: (id: string) => { getIsSorted: () => "asc" | "desc" | null } } };

function buildColumns(ctx: CustomerColumnCtx) {
  const stateVariants: Record<string, string> = {
    enabled: "bg-green-50 text-green-700 border border-green-100",
    disabled: "bg-red-50 text-red-700 border border-red-100",
    invited: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    declined: "bg-muted text-muted-foreground border border-muted",
  };

  return [
    {
      id: "selection",
      header: (_: TableHeaderCtx) => (
        <input
          type="checkbox"
          checked={ctx.allSelected || ctx.someSelected}
          onChange={(e) => ctx.onSelectAll(e.target.checked)}
          aria-label="Select all"
        />
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell: ({ row }: { row: any }) => (
        <input
          type="checkbox"
          checked={ctx.isSelected(row.original.id)}
          onChange={(e) => ctx.onSelect(row.original.id, e.target.checked)}
          aria-label={`Select ${customerDisplayName(row.original)}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: "Customer name",
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
              {initials(c)}
            </div>
            <div className="min-w-0">
              <div className="text-body font-medium truncate">
                {customerDisplayName(c)}
              </div>
              {c.email && (
                <div className="text-xs text-muted-foreground truncate">{c.email}</div>
              )}
            </div>
          </div>
        );
      },
      enableSorting: true,
      meta: { align: "left" },
    },
    {
      id: "email",
      accessorKey: "email",
      header: "Email",
      cell: ({ row }: { row: any }) => (
        <div className="text-xs text-muted-foreground truncate max-w-[34ch]">
          {row.original.email ?? "—"}
        </div>
      ),
      enableSorting: true,
      meta: { align: "left" },
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }: { row: any }) => (
        <div className="text-xs text-muted-foreground truncate">
          {row.original.phone ?? "—"}
        </div>
      ),
      enableSorting: false,
      meta: { align: "left" },
    },
    {
      id: "orders",
      accessorKey: "orders_count",
      header: "Orders",
      cell: ({ row }: { row: any }) => (
        <div className="text-body text-right">{row.original.orders_count}</div>
      ),
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "total_spent",
      accessorKey: "total_spent",
      header: "Total spent",
      cell: ({ row }: { row: any }) => (
        <div className="text-body text-right font-medium">
          {formatCurrency(Number(row.original.total_spent || 0))}
        </div>
      ),
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "marketing",
      accessorKey: "accepts_marketing",
      header: "Marketing",
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        if (!c.accepts_marketing) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
              Not subscribed
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
            <span>Subscribed</span>
            {c.marketing_opt_in_level && c.marketing_opt_in_level !== "unknown" && (
              <span className="ml-1 opacity-70">({marketingLabel(c.marketing_opt_in_level)})</span>
            )}
          </span>
        );
      },
      enableSorting: false,
      meta: { align: "left" },
    },
    {
      id: "state",
      accessorKey: "state",
      header: "Customer state",
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        const isDisabled = c.state === "disabled";
        const variant = stateVariants[c.state] || stateVariants.enabled;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${variant}`}>
            {stateLabel(c.state)}
            {isDisabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.onEnable(c.id, customerDisplayName(c));
                }}
                className="ml-1 inline-flex h-3 w-3 items-center justify-center text-[10px] text-green-600 ring-1 ring-inset ring-green-600/30 rounded-full hover:bg-green-600/10 focus:outline-none"
                aria-label={`Enable ${customerDisplayName(c)}`}
              >
                <Check className="size-2" />
              </button>
            )}
          </span>
        );
      },
      enableSorting: true,
      meta: { align: "left" },
    },
    {
      id: "last_order",
      accessorKey: "last_order_at",
      header: "Last order",
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        if (!c.last_order_at) return <span className="text-xs text-muted-foreground">—</span>;
        const date = new Date(c.last_order_at).toLocaleDateString();
        return <div className="text-xs text-muted-foreground">{date}</div>;
      },
      enableSorting: true,
      meta: { align: "left" },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Created date",
      cell: ({ row }: { row: any }) => {
        const date = new Date(row.original.created_at).toLocaleDateString();
        return <div className="text-xs text-muted-foreground">{date}</div>;
      },
      enableSorting: true,
      meta: { align: "left" },
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        if (!c.tags || c.tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {c.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-transparent">
                {tag}
              </span>
            ))}
            {c.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded text-xs text-muted-foreground">
                +{c.tags.length - 3}
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
      meta: { align: "left" },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }: { row: any }) => {
        const c = row.original;
        const isDisabled = c.state === "disabled";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Customer actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => ctx.onView(c.id)}>
                <Eye className="mr-2 size-4" /> View details
              </DropdownMenuItem>
              {ctx.canUpdate && (
                <DropdownMenuItem onSelect={() => ctx.onEdit(c.id)}>
                  <Mail className="mr-2 size-4" /> Edit customer
                </DropdownMenuItem>
              )}
              {ctx.canArchive && !isDisabled && (
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => ctx.onArchive(c.id, customerDisplayName(c))}
                >
                  <Archive className="mr-2 size-4" /> Disable customer
                </DropdownMenuItem>
              )}
              {ctx.canArchive && isDisabled && (
                <DropdownMenuItem onSelect={() => ctx.onEnable(c.id, customerDisplayName(c))}>
                  <ShieldAlert className="mr-2 size-4" /> Enable customer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
