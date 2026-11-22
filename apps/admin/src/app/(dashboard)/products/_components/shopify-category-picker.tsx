"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";
import type { UseFormReturn } from "react-hook-form";

type TaxonomyAttribute = { name?: string; label?: string; key?: string };
type TaxonomyRow = {
  shopify_category_id: string;
  name: string;
  full_name: string;
  parent_shopify_category_id: string | null;
  level: number;
  is_leaf: boolean;
  attributes?: Record<string, unknown> | TaxonomyAttribute[] | null;
};

const CATEGORY_FIELDS: Record<string, string[]> = {
  "clothing accessories": ["Color", "Accessory size", "Fabric", "Material", "Accessory pieces included", "Age group", "Care instructions", "Target gender"],
};

function attributeLabels(row: TaxonomyRow | null): string[] {
  if (!row) return [];
  if (Array.isArray(row.attributes)) return row.attributes.map((attribute) => attribute.label ?? attribute.name ?? attribute.key).filter((label): label is string => Boolean(label));
  if (row.attributes && typeof row.attributes === "object" && Object.keys(row.attributes).length > 0) return Object.keys(row.attributes).map((key) => key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  return CATEGORY_FIELDS[row.name.toLowerCase()] ?? [];
}

export function ShopifyCategoryPicker({ form }: { form: UseFormReturn<ProductFormValues> }) {
  const selectedId = form.watch("shopify_category_id");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<TaxonomyRow[]>([]);
  const [selected, setSelected] = React.useState<TaxonomyRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [parent, setParent] = React.useState<TaxonomyRow | null>(null);
  const [breadcrumbs, setBreadcrumbs] = React.useState<TaxonomyRow[]>([]);

  const loadCategories = React.useCallback(async (parentId: string | null, search: string) => {
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    let request = supabase.from("shopify_product_categories").select("shopify_category_id, name, full_name, parent_shopify_category_id, level, is_leaf, attributes").order("name", { ascending: true }).limit(search.trim() ? 100 : 200);
    if (search.trim()) request = request.ilike("full_name", `%${search.trim()}%`);
    else if (parentId) request = request.eq("parent_shopify_category_id", parentId);
    else request = request.is("parent_shopify_category_id", null);
    const { data } = await request;
    setResults((data as TaxonomyRow[] | null) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!selectedId) { setSelected(null); return; }
    const supabase = createBrowserSupabaseClient();
    void supabase.from("shopify_product_categories").select("shopify_category_id, name, full_name, parent_shopify_category_id, level, is_leaf, attributes").eq("shopify_category_id", selectedId).maybeSingle().then(({ data }) => {
      if (!cancelled) setSelected((data as TaxonomyRow | null) ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadCategories(parent?.shopify_category_id ?? null, query), 150);
    return () => window.clearTimeout(timer);
  }, [loadCategories, open, parent, query]);

  const openPicker = () => { setOpen(true); setQuery(""); setParent(null); setBreadcrumbs([]); };
  const choose = (item: TaxonomyRow) => {
    if (!item.is_leaf) { setBreadcrumbs((current) => [...current, item]); setParent(item); setQuery(""); return; }
    form.setValue("shopify_category_id", item.shopify_category_id, { shouldDirty: true, shouldValidate: true });
    setSelected(item); setOpen(false); setQuery("");
  };
  const goBack = () => { const next = breadcrumbs.slice(0, -1); setBreadcrumbs(next); setParent(next.at(-1) ?? null); setQuery(""); };
  const fields = attributeLabels(selected);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Category</label>
        {selectedId && <Button type="button" variant="ghost" size="sm" onClick={() => { form.setValue("shopify_category_id", null, { shouldDirty: true, shouldValidate: true }); setSelected(null); }}>Clear</Button>}
      </div>
      {selected ? <button type="button" className="w-full rounded-md border bg-muted/30 px-3 py-2 text-left text-sm" onClick={openPicker}><span className="font-medium">{selected.name}</span><span className="block truncate text-xs text-muted-foreground">{selected.full_name}</span></button> : <Button type="button" variant="outline" className="w-full justify-start" onClick={openPicker}>Choose a product category</Button>}
      {open && <div className="rounded-md border bg-background shadow-sm" role="dialog" aria-label="Choose a product category">
        <div className="p-3 pb-2"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories" /></div>
        {!query.trim() && breadcrumbs.length > 0 && <button type="button" className="w-full border-y px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted" onClick={goBack}>← Back to {breadcrumbs.length > 1 ? breadcrumbs.at(-2)?.name : "All"}</button>}
        <div className="max-h-64 overflow-auto p-1">{loading ? <p className="p-3 text-xs text-muted-foreground">Loading categories…</p> : results.length === 0 ? parent && !query.trim() ? <button type="button" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => choose({ ...parent, is_leaf: true })}><span className="block font-medium">Use {parent.name}</span><span className="block text-xs text-muted-foreground">No child categories are available in this taxonomy release.</span></button> : <p className="p-3 text-xs text-muted-foreground">No matching categories.</p> : results.map((item) => <button key={item.shopify_category_id} type="button" className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => choose(item)}><span className="min-w-0"><span className="block truncate font-medium">{item.name}</span>{query.trim() && <span className="block truncate text-xs text-muted-foreground">{item.full_name}</span>}</span>{!item.is_leaf && <span className="pl-3 text-muted-foreground">›</span>}</button>)}</div>
        <div className="flex justify-end border-t p-2"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button></div>
      </div>}
      {selected && fields.length > 0 && <div className="rounded-md border bg-muted/10 p-3"><p className="text-sm font-medium">Category metafields</p><p className="mt-1 text-xs text-muted-foreground">Shopify fields available for {selected.name}.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{fields.map((field) => <div key={field} className="rounded border bg-background px-3 py-2 text-sm">{field}</div>)}</div></div>}
      <p className="text-xs text-muted-foreground">Determines tax rates and adds metafields to improve search, filters, and cross-channel sales.</p>
    </div>
  );
}
