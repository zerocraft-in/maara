"use client";

/**
 * Re-export of the shared DataTable implementation.
 *
 * The canonical implementation lives in the products module
 * (@/app/(dashboard)/products/data-table). This file is kept as a re-export
 * so that any existing or future imports from @/components/layout/data-table
 * continue to resolve without duplicating the component.
 */

export { DataTable } from "@/app/(dashboard)/products/data-table";
