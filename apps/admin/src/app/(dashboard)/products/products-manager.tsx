"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  archiveProduct,
  setProductStatus,
  bulkArchiveProducts,
  bulkSetProductStatus,
} from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Search, Filter, Plus, MoreHorizontal, ChevronDown } from "lucide-react";

import { DataTable } from "./data-table";
import { buildColumns, type ProductColumnCtx } from "./columns";
import type { ColumnDef } from "@tanstack/react-table";
import type { ProductRow, StatusFilter } from "./types";

type ProductTableColumns = ColumnDef<ProductRow, unknown>[];

interface ProductsManagerProps {
  organizationId: string;
  permissions: Set<string>;
}

type SortField = "name" | "created_at" | "updated_at" | "status" | "vendor" | "product_type";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export default function ProductsManager({
  organizationId,
  permissions,
}: ProductsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = permissions.has("products.create");
  const canUpdate = permissions.has("products.update");
  const canArchive = permissions.has("products.archive");

  // ---- URL-synced filter state ----
  const [searchQuery, setSearchQuery] = React.useState(() =>
    searchParams.get("q") ?? "",
  );
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(() =>
    (searchParams.get("status") ?? "all") as StatusFilter,
  );
  const [vendorFilter, setVendorFilter] = React.useState(() =>
    searchParams.get("vendor") ?? "",
  );
  const [productTypeFilter, setProductTypeFilter] = React.useState(() =>
    searchParams.get("product_type") ?? "",
  );
  const [pageIndex, setPageIndex] = React.useState(() => {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    return page - 1;
  });
  const [pageSize, setPageSize] = React.useState(() => {
    const size = Number(searchParams.get("page_size")) || DEFAULT_PAGE_SIZE;
    return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
  });
  const [sortField, setSortField] = React.useState<SortField>(() => {
    const valid: SortField[] = [
      "name",
      "created_at",
      "updated_at",
      "status",
      "vendor",
      "product_type",
    ];
    const raw = (searchParams.get("sort") ?? "created_at") as SortField;
    return valid.includes(raw) ? raw : "created_at";
  });
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(() =>
    searchParams.get("dir") === "asc" ? "asc" : "desc",
  );

  const [hiddenColumnIds, setHiddenColumnIds] = React.useState<string[]>([]);

  // Push filter/sort/pagination state to the URL without scrolling.
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (vendorFilter) params.set("vendor", vendorFilter);
    if (productTypeFilter) params.set("product_type", productTypeFilter);
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
    searchQuery,
    statusFilter,
    vendorFilter,
    productTypeFilter,
    pageIndex,
    pageSize,
    sortField,
    sortDirection,
    pathname,
    router,
  ]);

  // ---- Fetch products ----
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [vendors, setVendors] = React.useState<string[]>([]);
  const [productTypes, setProductTypes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/products?organization_id=${organizationId}`,
        );
        if (!response.ok) throw new Error("Failed to load products");
        const data = await response.json();
        setProducts(data.products);
        setVendors(data.vendors);
        setProductTypes(data.productTypes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [organizationId]);

  // ---- Client-side filtering (persisted in URL) ----
  const filteredProducts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        product.name.toLowerCase().includes(query) ||
        (product.description ?? "").toLowerCase().includes(query) ||
        (product.vendor ?? "").toLowerCase().includes(query) ||
        (product.product_type ?? "").toLowerCase().includes(query) ||
        product.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        product.product_variants.some(
          (variant) =>
            variant.sku.toLowerCase().includes(query) ||
            (variant.barcode ?? "").toLowerCase().includes(query),
        );
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesVendor = !vendorFilter || product.vendor === vendorFilter;
      const matchesProductType =
        !productTypeFilter || product.product_type === productTypeFilter;
      return matchesSearch && matchesStatus && matchesVendor && matchesProductType;
    });
  }, [
    products,
    searchQuery,
    statusFilter,
    vendorFilter,
    productTypeFilter,
  ]);

  // ---- Selection ----
  const [selectedProducts, setSelectedProducts] = React.useState<string[]>([]);
  const allSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProducts.includes(p.id));
  const someSelected =
    selectedProducts.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isSelected = (id: string) => selectedProducts.includes(id);

  // ---- Bulk actions ----

  const handleBulkArchive = async () => {
    if (selectedProducts.length === 0) return;
    if (!window.confirm(`Archive ${selectedProducts.length} product(s)?`)) return;

    try {
      const result = await bulkArchiveProducts({ ids: selectedProducts });
      if (result.ok) {
        toast.success(`${selectedProducts.length} product(s) archived.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSelectedProducts([]);
    }
  };

  const handleBulkStatusChange = async (status: "draft" | "active") => {
    if (selectedProducts.length === 0) return;

    try {
      const result = await bulkSetProductStatus({
        ids: selectedProducts,
        status,
      });
      if (result.ok) {
        toast.success(`${selectedProducts.length} product(s) set to ${status}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSelectedProducts([]);
    }
  };

  const handleArchive = async (productId: string, productName: string) => {
    if (!window.confirm(`Archive "${productName}"?`)) return;

    try {
      const result = await archiveProduct({ id: productId });
      if (result.ok) {
        toast.success("Product archived.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to archive product.");
    }
  };

  const handleStatusChange = async (
    productId: string,
    status: "draft" | "active",
  ) => {
    try {
      const result = await setProductStatus({ id: productId, status });
      if (result.ok) {
        toast.success(
          status === "active" ? "Product published." : "Product set to draft.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change product status.");
    }
  };

  const handleSortChange = (sorting: { id: string; desc: boolean }[]) => {
    const [s] = sorting;
    if (!s) return;
    setSortField(
      (["name", "created_at", "updated_at", "status", "vendor", "product_type"].includes(
        s.id,
      )
        ? (s.id as SortField)
        : "created_at"),
    );
    setSortDirection(s.desc ? "desc" : "asc");
  };

  const columnsCtx: ProductColumnCtx = {
    canUpdate,
    canArchive,
    onView: (id) => router.push(`/products/${id}`),
    onEdit: (id) => router.push(`/products/${id}`),
    onStatusChange: handleStatusChange,
    onArchive: handleArchive,
    onSelect: handleSelectProduct,
    onSelectAll: handleSelectAll,
    isSelected,
    allSelected,
    someSelected,
  };

  const allColumns = buildColumns(columnsCtx);
  const columns = allColumns.filter(
    (c) => c.id && !hiddenColumnIds.includes(c.id),
  );

  const tableColumns: ProductTableColumns = columns as ProductTableColumns;

  const sorting = [{ id: sortField, desc: sortDirection === "desc" }];
  const pagination = { pageIndex, pageSize };

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-[16px] font-bold text-brand-fg"
          >
            <MoreHorizontal className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-body">
              Products
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your products, inventory, and variants
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Bulk actions bar */}
          {selectedProducts.length > 0 && (
            <div className="fixed bottom-4 right-4 z-50 w-full sm:w-auto">
              <Card className="shadow-lg border-destructive">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="text-sm font-medium">
                    {selectedProducts.length} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="outline" size="sm">
                        Bulk actions <ChevronDown className="size-4 ml-1" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleBulkStatusChange("active")}>
                        Publish selected
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange("draft")}>
                        Set to draft
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleBulkArchive}
                        className="text-destructive"
                      >
                        Archive selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProducts([])}
                  >
                    Clear
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/products/new")}
              disabled={!canCreate}
            >
              <Plus className="size-4 mr-2" />
              Add product
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              {vendors.length > 0 && (
                <Select value={vendorFilter} onValueChange={(value) => setVendorFilter(value ?? "")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All vendors</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {productTypes.length > 0 && (
                <Select value={productTypeFilter} onValueChange={(value) => setProductTypeFilter(value ?? "")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    {productTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="size-4" />
                    Columns
                  </Button>
                } />
                <DropdownMenuContent align="end" className="w-56 p-2">
                  {[
                    { key: "image", label: "Image" },
                    { key: "title", label: "Title" },
                    { key: "vendor", label: "Vendor" },
                    { key: "product_type", label: "Type" },
                    { key: "variants", label: "Variants" },
                    { key: "inventory", label: "Inventory" },
                    { key: "price", label: "Price" },
                    { key: "status", label: "Status" },
                    { key: "collections", label: "Collections" },
                    { key: "created_at", label: "Created" },
                  ].map((col) => {
                    const hidden = hiddenColumnIds.includes(col.key);
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={!hidden}
                        onCheckedChange={() => {
                          setHiddenColumnIds((prev) =>
                            hidden
                              ? prev.filter((id) => id !== col.key)
                              : [...prev, col.key],
                          );
                        }}
                      >
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">
            {filteredProducts.length} product(s)
          </span>
        </div>
        <DataTable
            columns={tableColumns}
            data={filteredProducts}
            sorting={sorting}
            onSortingChange={handleSortChange}
            pagination={pagination}
            onPaginationChange={(next) => {
              setPageIndex(next.pageIndex);
              setPageSize(next.pageSize);
            }}
            className="overflow-x-auto"
            emptyState={
              <Empty className="border-0 p-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MoreHorizontal className="size-12 text-muted-foreground/50" />
                  </EmptyMedia>
                  <EmptyTitle>No products found</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery ||
                    statusFilter !== "all" ||
                    vendorFilter ||
                    productTypeFilter
                      ? "Try adjusting your search or filters."
                      : "Get started by adding your first product."}
                  </EmptyDescription>
                </EmptyHeader>
                {canCreate &&
                  !searchQuery &&
                  statusFilter === "all" &&
                  !vendorFilter &&
                  !productTypeFilter && (
                    <EmptyContent>
                      <Button onClick={() => router.push("/products/new")}>
                        <Plus className="size-4 mr-2" />
                        Add product
                      </Button>
                    </EmptyContent>
                  )}
              </Empty>
            }
          />
      </Card>
    </div>
  );
}
