"use client";

/**
 * Re-export of the shared ProductsManager implementation.
 *
 * The canonical implementation lives in the products module
 * (@/app/(dashboard)/products/products-manager). This file is kept as a
 * re-export so that any existing or future imports from
 * @/components/layout/products-manager continue to resolve without
 * duplicating the component.
 */

export { default as ProductsManager } from "@/app/(dashboard)/products/_components/products-manager";
