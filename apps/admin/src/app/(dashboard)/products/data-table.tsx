"use client";

import {
  flexRender,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type TableState,
} from "@tanstack/react-table";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ROW_MODELS } from "./data-table-features";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
  pageSizeOptions?: number[];
  enableSorting?: boolean;
  enablePagination?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  pageSizeOptions = [10, 25, 50, 100],
  enableSorting = true,
  enablePagination = true,
  className,
  emptyState = (
    <div className="text-muted-foreground text-center py-8">No data found.</div>
  ),
}: DataTableProps<TData>) {
  const table = useReactTable<TData>({
    columns,
    data,
    state: {
      sorting: sorting ?? [],
      pagination,
    } as TableState,
    onStateChange: (updater) => {
      const patch =
        typeof updater === "function" ? updater({} as TableState) : updater;
      if (patch.sorting) onSortingChange(patch.sorting);
      if (patch.pagination) onPaginationChange(patch.pagination);
    },
    getCoreRowModel: ROW_MODELS.getCoreRowModel,
    ...(enableSorting
      ? { getSortedRowModel: ROW_MODELS.getSortedRowModel }
      : {}),
    ...(enablePagination
      ? { getPaginationRowModel: ROW_MODELS.getPaginationRowModel }
      : {}),
    manualPagination: enablePagination,
  });

  const renderSortIndicator = (id: string) => {
    const column = table.getColumn(id);
    if (!column) return null;
    const isSorted = column.getIsSorted();
    if (isSorted === "asc") return <ChevronUp className="h-3 w-3" />;
    if (isSorted === "desc") return <ChevronDown className="h-3 w-3" />;
    return <ChevronsUpDown className="h-3 w-3 opacity-50" />;
  };

  const totalRows = data.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pagination.pageSize));
  const canPrevious = pagination.pageIndex > 0;
  const canNext = (pagination.pageIndex + 1) * pagination.pageSize < totalRows;

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {enableSorting && header.column.getCanSort() ? (
                          <button
                            onClick={(event) => {
                              header.column.getToggleSortingHandler()?.(event);
                            }}
                            aria-label={`Sort by ${header.id}`}
                            disabled={!header.column.getCanSort()}
                            className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs text-muted-foreground transition-colors hover:text-body focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50"
                          >
                            {renderSortIndicator(header.id)}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="text-center"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {enablePagination && totalRows > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {Math.min(
                pagination.pageIndex * pagination.pageSize + 1,
                totalRows,
              )}
            </span>
            <span className="text-muted-foreground"> to </span>
            <span className="text-muted-foreground">
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                totalRows,
              )}
            </span>
            <span className="text-muted-foreground"> of </span>
            <span className="text-muted-foreground">{totalRows}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onPaginationChange({
                  pageIndex: Math.max(0, pagination.pageIndex - 1),
                  pageSize: pagination.pageSize,
                })
              }
              disabled={!canPrevious}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                onPaginationChange({
                  pageIndex: pagination.pageIndex + 1,
                  pageSize: pagination.pageSize,
                })
              }
              disabled={!canNext}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Next
            </button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                onPaginationChange({
                  pageIndex: 0,
                  pageSize: Number(e.target.value),
                })
              }
              className="border bg-background px-2 py-1 text-sm rounded"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
