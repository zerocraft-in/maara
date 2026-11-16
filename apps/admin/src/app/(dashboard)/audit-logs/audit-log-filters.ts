export type AuditLogSort = "newest" | "oldest";

export type AuditLogEntityFilter =
  | "all"
  | "organization"
  | "member"
  | "invitation"
  | "location"
  | "category"
  | "product"
  | "product_variant";

export type AuditLogFilters = {
  query: string;
  entity: AuditLogEntityFilter;
  sort: AuditLogSort;
};

export const AUDIT_LOG_SORT_OPTIONS: ReadonlyArray<{
  value: AuditLogSort;
  label: string;
}> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export const AUDIT_LOG_ENTITY_OPTIONS: ReadonlyArray<{
  value: AuditLogEntityFilter;
  label: string;
}> = [
  { value: "all", label: "All entities" },
  { value: "organization", label: "Organization" },
  { value: "member", label: "Member" },
  { value: "invitation", label: "Invitation" },
  { value: "location", label: "Location" },
  { value: "category", label: "Category" },
  { value: "product", label: "Product" },
  { value: "product_variant", label: "Variant" },
];

export const DEFAULT_AUDIT_LOG_FILTERS: AuditLogFilters = {
  query: "",
  entity: "all",
  sort: "newest",
};

/**
 * Keeps only characters that are safe inside a PostgREST `or`/`ilike` filter
 * and caps the length. Commas and parentheses are separators in `or` filters,
 * while `%` is a wildcard, so they are intentionally removed.
 */
export function sanitizeSearchQuery(value: string): string {
  return value
    .trim()
    .slice(0, 100)
    .replace(/[^a-zA-Z0-9._\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAuditLogEntity(
  value: unknown,
): value is AuditLogEntityFilter {
  return (
    typeof value === "string" &&
    AUDIT_LOG_ENTITY_OPTIONS.some((option) => option.value === value)
  );
}

export function isAuditLogSort(value: unknown): value is AuditLogSort {
  return (
    typeof value === "string" &&
    AUDIT_LOG_SORT_OPTIONS.some((option) => option.value === value)
  );
}

export function parseAuditLogFilters(params: {
  [key: string]: string | string[] | undefined;
}): AuditLogFilters {
  const rawQuery = params.q;
  const rawEntity = params.entity;
  const rawSort = params.sort;

  return {
    query:
      typeof rawQuery === "string" ? sanitizeSearchQuery(rawQuery) : "",
    entity: isAuditLogEntity(rawEntity) ? rawEntity : "all",
    sort: isAuditLogSort(rawSort) ? rawSort : "newest",
  };
}

export function hasActiveAuditLogFilters(filters: AuditLogFilters): boolean {
  return (
    filters.query !== "" ||
    filters.entity !== DEFAULT_AUDIT_LOG_FILTERS.entity ||
    filters.sort !== DEFAULT_AUDIT_LOG_FILTERS.sort
  );
}

/**
 * Builds a stable `/audit-logs` URL. Page 1 is omitted so the base URL stays
 * canonical, and default filters are omitted to keep URLs short.
 */
export function buildAuditLogsHref(
  page: number,
  filters: AuditLogFilters,
): string {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.entity !== DEFAULT_AUDIT_LOG_FILTERS.entity) {
    params.set("entity", filters.entity);
  }
  if (filters.sort !== DEFAULT_AUDIT_LOG_FILTERS.sort) {
    params.set("sort", filters.sort);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/audit-logs?${queryString}` : "/audit-logs";
}
