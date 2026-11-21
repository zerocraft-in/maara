"use client";

import { type UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";

type ProductForm = UseFormReturn<ProductFormValues>;

interface OrganizationCardProps {
  form: ProductForm;
}

export function OrganizationCard({ form }: OrganizationCardProps) {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="border-b px-0 pb-3 pt-0">
        <CardTitle className="text-sm font-semibold">
          Product organization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pt-3">
        <div className="space-y-2">
          <Label htmlFor="product_type">Type</Label>
          <Select
            className="w-full"
            value={form.watch("product_type") ?? ""}
            onValueChange={(v) =>
              form.setValue("product_type", v ?? undefined)
            }
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue>None</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor</Label>
          <Select
            className="w-full"
            value={form.watch("vendor") ?? ""}
            onValueChange={(v) =>
              form.setValue("vendor", v ?? undefined)
            }
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue>None</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          type="button"
        >
          <Plus className="size-3" />
          Add collections
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          type="button"
        >
          <Plus className="size-3" />
          Add tags
        </Button>
      </CardContent>
    </Card>
  );
}
