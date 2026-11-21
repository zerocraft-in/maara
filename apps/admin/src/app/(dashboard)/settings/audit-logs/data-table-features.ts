import {
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";

/**
 * Default initial sorting for tables: newest first by `created_at`.
 */
export const DEFAULT_SORTING: SortingState = [{ id: "created_at", desc: true }];

/**
 * TanStack row model getters used by the generic DataTable component.
 */
export const ROW_MODELS = {
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
} as const;
