"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  X,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useProductFormState,
} from "@/app/(dashboard)/products/lib/product-form-state";
import type { VariantInput } from "@/app/(dashboard)/products/lib/product-schema";
import { validateVariants } from "@/app/(dashboard)/products/lib/variant-generator";

const VARIANT_LIMIT = 100;

interface VariantEditorProps {
  onVariantChange?: (variants: VariantInput[]) => void;
}

/**
 * Variant editor: manages product options and the generated variant matrix.
 *
 * - Up to 3 options (Size, Color, Material, …)
 * - Cartesian-product variant generation
 * - Per-variant SKU, barcode, price, compare-at, cost, quantity, weight
 * - Bulk-edit controls
 * - Field-level validation errors (duplicate SKU, bad barcode, etc.)
 */
export function VariantEditor({ onVariantChange }: VariantEditorProps) {
  const {
    options,
    variants,
    addOption,
    removeOption,
    updateOptionName,
    updateOptionValue,
    addOptionValue,
    removeOptionValue,
    setVariantField,
    removeVariant,
    setVariantDefaults,
  } = useProductFormState();

  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkField, setBulkField] = React.useState<keyof VariantInput>("price");
  const [bulkValue, setBulkValue] = React.useState("");

  // Derived during render (pure computation from variants).
  const variantErrors = validateVariants(variants);
  const variantsCount = variants.length;
  const atLimit = variantsCount >= VARIANT_LIMIT;

  const totalErrorCount = Object.values(variantErrors).reduce(
    (acc, e) => acc + Object.keys(e).length,
    0,
  );

  const handleBulkApply = () => {
    if (!bulkValue) {
      setBulkOpen(false);
      return;
    }
    setVariantDefaults({ [bulkField]: bulkValue });
    setBulkOpen(false);
    setBulkValue("");
  };

  const handleAddOption = () => {
    if (options.length >= 3) return;
    addOption();
  };

  const handleRemoveOption = (index: number) => {
    removeOption(index);
  };

  const handleAddOptionValue = (optionIndex: number) => {
    addOptionValue(optionIndex);
  };

  const handleRemoveOptionValue = (optionIndex: number, valueIndex: number) => {
    removeOptionValue(optionIndex, valueIndex);
  };

  const handleRemoveVariant = (index: number) => {
    removeVariant(index);
  };

  React.useEffect(() => {
    onVariantChange?.(variants);
  }, [variants, onVariantChange]);

  return (
    <section className="space-y-6">
      {/* Options editor */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
          <CardTitle className="text-sm">Options</CardTitle>
          <p className="text-xs text-muted-foreground">
            Up to 3 options. Each value combination becomes a variant.
          </p>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {options.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddOption}
              className="w-fit"
            >
              <Plus className="size-4 mr-2" />
              Add option like size or color
            </Button>
          ) : (
            <>
              {options.map((option, optionIndex) => (
                <Card
                  key={`option-${optionIndex}`}
                  className="p-4 border-border"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical
                          className="text-muted-foreground cursor-grab size-4"
                        />
                        <Input
                          value={option.name}
                          onChange={(e) =>
                            updateOptionName(optionIndex, e.target.value)
                          }
                          placeholder={`Option ${optionIndex + 1} name`}
                          className="w-auto min-w-[140px] text-sm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Values create variant combinations
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(optionIndex)}
                      disabled={options.length <= 1}
                      aria-label="Remove option"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value, valueIndex) => (
                      <div
                        key={valueIndex}
                        className="flex items-center gap-1"
                      >
                        <Input
                          value={value}
                          onChange={(e) =>
                            updateOptionValue(optionIndex, valueIndex, e.target.value)
                          }
                          placeholder={`Value ${valueIndex + 1}`}
                          className="w-auto min-w-[120px] text-sm"
                        />
                        {option.values.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleRemoveOptionValue(optionIndex, valueIndex)
                            }
                            aria-label="Remove value"
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddOptionValue(optionIndex)}
                      className="h-9"
                    >
                      <Plus className="size-3.5 mr-1.5" />
                      Add value
                    </Button>
                  </div>
                </Card>
              ))}
              {options.length < 3 && !atLimit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddOption}
                  className="w-fit mt-2"
                >
                  <Plus className="size-4 mr-2" />
                  Add another option
                </Button>
              )}
              {atLimit && (
                <p className="text-xs text-muted-foreground">
                  Maximum {VARIANT_LIMIT} variants reached.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Variant matrix table */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Variants</CardTitle>
            <Badge variant="secondary">{variantsCount}</Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={variantsCount === 0}
          >
            Bulk edit
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {variantsCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Add options above to generate variants.
            </div>
          ) : (
            <div className="overflow-x-auto border-b border-border">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px] uppercase text-muted-foreground">
                    <TableCell className="w-20">SKU</TableCell>
                    <TableCell>Variant</TableCell>
                    <TableCell className="w-32">Price</TableCell>
                    <TableCell className="w-32">Compare at</TableCell>
                    <TableCell className="w-32">Cost</TableCell>
                    <TableCell className="w-24">Qty</TableCell>
                    <TableCell className="w-24">Weight</TableCell>
                    <TableCell className="w-20">Active</TableCell>
                    <TableCell className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant, variantIndex) => {
                    const fieldErrors = variantErrors[variantIndex] ?? {};
                    const hasError = Object.keys(fieldErrors).length > 0;
                    return (
                      <TableRow
                        key={variant.id ?? variantIndex}
                        className={cn("group", hasError && "bg-destructive/10")}
                      >
                        <TableCell className="pr-0">
                          <Input
                            value={variant.sku}
                            onChange={(e) =>
                              setVariantField(variantIndex, "sku", e.target.value)
                            }
                            placeholder="SKU"
                            className="w-full text-sm bg-transparent"
                            aria-invalid={!!fieldErrors.sku}
                          />
                          {fieldErrors.sku && (
                            <p className="text-xs text-destructive mt-1">
                              {fieldErrors.sku}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-body">
                            {[
                              variant.option1,
                              variant.option2,
                              variant.option3,
                            ]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">
                              ₹
                            </span>
                            <Input
                              value={variant.price}
                              onChange={(e) =>
                                setVariantField(
                                  variantIndex,
                                  "price",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="w-[80px] text-sm bg-transparent"
                              aria-invalid={!!fieldErrors.price}
                            />
                            {fieldErrors.price && (
                              <p className="text-xs text-destructive mt-1">
                                {fieldErrors.price}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">
                              ₹
                            </span>
                            <Input
                              value={variant.compare_at_price ?? ""}
                              onChange={(e) =>
                                setVariantField(
                                  variantIndex,
                                  "compare_at_price",
                                  e.target.value || null,
                                )
                              }
                              placeholder="0.00"
                              className="w-[80px] text-sm bg-transparent"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">
                              ₹
                            </span>
                            <Input
                              value={variant.cost_per_item}
                              onChange={(e) =>
                                setVariantField(
                                  variantIndex,
                                  "cost_per_item",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="w-[80px] text-sm bg-transparent"
                              aria-invalid={!!fieldErrors.cost_per_item}
                            />
                            {fieldErrors.cost_per_item && (
                              <p className="text-xs text-destructive mt-1">
                                {fieldErrors.cost_per_item}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={variant.quantity}
                            onChange={(e) =>
                              setVariantField(
                                variantIndex,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-[72px] text-right text-sm bg-transparent"
                            aria-invalid={!!fieldErrors.quantity}
                          />
                          {fieldErrors.quantity && (
                            <p className="text-xs text-destructive mt-1">
                              {fieldErrors.quantity}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              value={variant.weight ?? ""}
                              onChange={(e) =>
                                setVariantField(
                                  variantIndex,
                                  "weight",
                                  e.target.value || null,
                                )
                              }
                              placeholder="0"
                              className="w-[48px] text-sm bg-transparent"
                            />
                            <Select
                              value={variant.weight_unit}
                              onValueChange={(v) =>
                                setVariantField(
                                  variantIndex,
                                  "weight_unit",
                                  (v ?? variant.weight_unit) as VariantInput["weight_unit"],
                                )
                              }
                              className="w-[64px]"
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={variant.weight_unit} />
                              </SelectTrigger>
                              <SelectContent>
                                {["g", "kg", "oz", "lb"].map((u) => (
                                  <SelectItem key={u} value={u}>
                                    {u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="w-20">
                          <Switch
                            checked={variant.is_active}
                            onCheckedChange={(v) =>
                              setVariantField(variantIndex, "is_active", v)
                            }
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="w-20">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveVariant(variantIndex)}
                            className="h-7 w-7 p-0"
                            aria-label="Remove variant"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalErrorCount > 0 && (
          <CardFooter className="border-t border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-sm text-destructive">
                {totalErrorCount} variant field error{totalErrorCount === 1 ? "" : "s"}.
                Please fix before saving.
              </p>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Bulk edit dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>
              Bulk edit {variantsCount} variant{variantsCount === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Apply one value to every variant below.
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          <div className="space-y-3 p-4">
            <Label>Field</Label>
            <Select
              value={bulkField}
              onValueChange={(v) =>
                setBulkField((v ?? bulkField) as keyof VariantInput)
              }
              className="w-full"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="compare_at_price">
                  Compare-at price
                </SelectItem>
                <SelectItem value="cost_per_item">Cost per item</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="requires_shipping">
                  Requires shipping
                </SelectItem>
                <SelectItem value="track_quantity">Track quantity</SelectItem>
                <SelectItem value="continue_selling_when_out_of_stock">
                  Continue selling when out of stock
                </SelectItem>
                <SelectItem value="is_active">Active</SelectItem>
              </SelectContent>
            </Select>

            <Label>Value</Label>
            <Input
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder="Enter value"
              className="w-full"
            />

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleBulkApply} disabled={!bulkValue}>
                Apply to all
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
