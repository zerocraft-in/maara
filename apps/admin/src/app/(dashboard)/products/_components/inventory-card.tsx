"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";

type ProductForm = UseFormReturn<ProductFormValues>;

interface InventoryCardProps {
  form: ProductForm;
  inventoryOpen: boolean;
  setInventoryOpen: (open: boolean) => void;
}

export function InventoryCard({
  form,
  inventoryOpen,
  setInventoryOpen,
}: InventoryCardProps) {
  return (
    <Card className="">
      <CardHeader className="flex flex-row justify-between gap-2 py-0">
        <CardTitle className="text-sm">Inventory</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {form.watch("track_quantity")
              ? "Inventory tracked"
              : "Not tracked"}
          </span>
          <Switch
            checked={form.watch("track_quantity")}
            onCheckedChange={(v) => form.setValue("track_quantity", v)}
            size="sm"
          />
        </div>
      </CardHeader>
      {form.watch("track_quantity") && (
        <CardContent className="border m-2 p-2 rounded-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-2 gap-4 text-sm">
              <span className="text-muted-foreground">Quantity</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 text-sm">
              <span className="text-muted-foreground">
                Shop location
              </span>
              <div className="relative inline-flex items-center">
                <Input
                  id="quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.watch("quantity")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d+$/.test(val)) {
                      form.setValue("quantity", val);
                    }
                  }}
                  onBlur={() => {
                    if (form.watch("quantity") === "")
                      form.setValue("quantity", "0");
                  }}
                  className="w-[72px] text-right text-sm pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="absolute right-1 inset-y-1 flex flex-col justify-center">
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    className="flex items-center justify-center h-4 w-5 rounded-sm text-[9px] leading-none text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() =>
                      form.setValue(
                        "quantity",
                        String(
                          Math.max(
                            0,
                            Number(form.watch("quantity") || 0) + 1,
                          ),
                        ),
                      )
                    }
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={Number(form.watch("quantity") || 0) <= 0}
                    className="flex items-center justify-center h-4 w-5 rounded-sm text-[9px] leading-none text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    onClick={() =>
                      form.setValue(
                        "quantity",
                        String(
                          Math.max(
                            0,
                            Number(form.watch("quantity") || 0) - 1,
                          ),
                        ),
                      )
                    }
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
      <CardFooter className="flex items-center justify-between gap-2 p-4">
        <Collapsible
          open={inventoryOpen}
          onOpenChange={setInventoryOpen}
          className="w-full"
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between">
            {inventoryOpen ? (
              <>
                <div
                  className="flex flex-row items-center justify-between w-full cursor-pointer group"
                  onClick={() => setInventoryOpen(false)}
                >
                  <p className="text-sm font-medium">More details</p>
                  <ChevronUp className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                </div>
              </>
            ) : (
              <div
                className="flex items-center justify-between w-full cursor-pointer group"
                onClick={() => setInventoryOpen(true)}
              >
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs h-7 rounded-lg shrink-0">
                    SKU
                  </Badge>
                  <Badge variant="outline" className="text-xs h-7 rounded-lg shrink-0">
                    Barcodes
                  </Badge>
                  <Badge variant="outline" className="text-xs h-7 rounded-lg shrink-0">
                    Sell when out of stock{" "}
                    {form.watch("continue_selling_when_out_of_stock") ? "On" : "Off"}
                  </Badge>
                </div>
                <ChevronDown className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
              </div>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2">
              {inventoryOpen && (
                <div className="mt-3 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="inventory-sku"
                        className="text-sm text-muted-foreground"
                      >
                        SKU (Stock Keeping Unit)
                      </Label>
                      <Input
                        id="inventory-sku"
                        placeholder="SKU"
                        {...form.register("sku")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="inventory-barcodes"
                        className="text-sm text-muted-foreground"
                      >
                        Barcodes
                      </Label>
                      <Input
                        id="inventory-barcodes"
                        placeholder="ISBN, UPC, GTIN, etc."
                        {...form.register("barcode")}
                      />
                    </div>
                  </div>
                  {form.watch("track_quantity") && (
                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        id="continue-selling"
                        checked={form.watch(
                          "continue_selling_when_out_of_stock",
                        )}
                        onCheckedChange={(v) =>
                          form.setValue(
                            "continue_selling_when_out_of_stock",
                            v,
                          )
                        }
                      />
                      <label
                        htmlFor="continue-selling"
                        className="text-sm text-muted-foreground cursor-select-none"
                      >
                        Continue selling when out of stock
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardFooter>
    </Card>
  );
}
