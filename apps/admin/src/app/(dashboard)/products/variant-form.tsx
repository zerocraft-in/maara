"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { createVariant, updateVariant } from "./actions";
import {
  MoneyError,
  rupeesToPaise,
  paiseToInputValue,
  paise,
} from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(40, "SKU must be at most 40 characters")
    .regex(/^[A-Za-z0-9-]+$/, "SKU must be alphanumeric or hyphen"),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9]{8,14}$/, "Barcode must be 8-14 digits")
    .optional()
    .or(z.literal("")),
  size: z
    .string()
    .trim()
    .max(20, "Size must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  colour: z
    .string()
    .trim()
    .max(40, "Colour must be at most 40 characters")
    .optional()
    .or(z.literal("")),
  cost_price: z.string().trim().min(1, "Cost price is required"),
  selling_price: z.string().trim().min(1, "Selling price is required"),
  tax_rate_percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Tax rate must be a percentage from 0 to 100")
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => value === "" || value === undefined || Number(value) <= 100,
      "Tax rate must be 100% or less",
    ),
  reorder_point: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Reorder point must be a whole number"),
});

type VariantFormValues = z.infer<typeof variantSchema>;

type VariantFormMode = "create" | "edit";

interface VariantFormProps {
  mode: VariantFormMode;
  productId: string;
  productName: string;
  variant?: {
    id: string;
    sku: string;
    barcode: string | null;
    size: string | null;
    colour: string | null;
    cost_price_paise: number;
    selling_price_paise: number;
    tax_rate_bps: number | null;
    reorder_point: number;
  };
  onSuccess: () => void;
  onClose: () => void;
}

export default function VariantForm({
  mode,
  productId,
  productName,
  variant,
  onSuccess,
  onClose,
}: VariantFormProps) {
  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: variant?.sku ?? "",
      barcode: variant?.barcode ?? "",
      size: variant?.size ?? "",
      colour: variant?.colour ?? "",
      cost_price: variant
        ? paiseToInputValue(paise(variant.cost_price_paise))
        : "",
      selling_price: variant
        ? paiseToInputValue(paise(variant.selling_price_paise))
        : "",
      tax_rate_percent:
        variant?.tax_rate_bps != null
          ? String(variant.tax_rate_bps / 100)
          : "",
      reorder_point: String(variant?.reorder_point ?? 0),
    },
  });

  const isEdit = mode === "edit";
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async (values: VariantFormValues) => {
    setSubmitError(null);

    let costPaise: number;
    let sellingPaise: number;
    try {
      costPaise = rupeesToPaise(values.cost_price);
      sellingPaise = rupeesToPaise(values.selling_price);
    } catch (error) {
      setSubmitError(
        error instanceof MoneyError
          ? error.message
          : "Enter valid prices with at most two decimal places.",
      );
      return;
    }

    if (costPaise < 0 || sellingPaise < 0) {
      setSubmitError("Prices cannot be negative.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      sku: values.sku,
      barcode: values.barcode,
      size: values.size,
      colour: values.colour,
      cost_price_paise: costPaise,
      selling_price_paise: sellingPaise,
      tax_rate_bps:
        values.tax_rate_percent === ""
          ? null
          : Math.round(Number(values.tax_rate_percent) * 100),
      reorder_point: Number(values.reorder_point),
    };

    try {
      const result = isEdit
        ? await updateVariant({ ...payload, id: variant!.id })
        : await createVariant({ ...payload, product_id: productId });

      if (result.ok) {
        onSuccess();
      } else {
        setSubmitError(result.error);
      }
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Edit Variant" : "Add Variant"}
        </CardTitle>
        <CardDescription>{productName}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">SKU</label>
              <input
                {...form.register("sku")}
                placeholder="e.g. OXF-WHT-M"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase ring-offset-background placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.sku && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sku.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">
                Barcode
              </label>
              <input
                {...form.register("barcode")}
                inputMode="numeric"
                placeholder="Optional 8-14 digits"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.barcode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.barcode.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">Size</label>
              <input
                {...form.register("size")}
                placeholder="e.g. M"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.size && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.size.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">Colour</label>
              <input
                {...form.register("colour")}
                placeholder="e.g. White"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.colour && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.colour.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">
                Cost price (₹)
              </label>
              <input
                {...form.register("cost_price")}
                inputMode="decimal"
                placeholder="0.00"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.cost_price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.cost_price.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">
                Selling price (₹)
              </label>
              <input
                {...form.register("selling_price")}
                inputMode="decimal"
                placeholder="0.00"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.selling_price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.selling_price.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">
                Tax rate (%)
              </label>
              <input
                {...form.register("tax_rate_percent")}
                inputMode="decimal"
                placeholder="Inherit from product"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.tax_rate_percent && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.tax_rate_percent.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-body">
                Reorder point
              </label>
              <input
                {...form.register("reorder_point")}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {form.formState.errors.reorder_point && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.reorder_point.message}
                </p>
              )}
            </div>
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <Separator className="mt-4 mb-4" />

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Add Variant"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
