"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoryOption } from "../types";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";

type ProductForm = UseFormReturn<ProductFormValues>;

interface ProductIdentityCardProps {
  form: ProductForm;
  categories: CategoryOption[];
  selectedMedia: Array<{ id: string; url: string; name: string }>;
  setMediaPickerOpen: (open: boolean) => void;
}

export function ProductIdentityCard({
  form,
  categories,
  selectedMedia,
  setMediaPickerOpen,
}: ProductIdentityCardProps) {
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);
  const descriptionField = form.register("description");

  const applyDescriptionFormat = React.useCallback(
    (prefix: string, suffix = prefix) => {
      const field = descriptionRef.current;
      const value = form.getValues("description") ?? "";
      if (!field) return;

      const start = field.selectionStart ?? value.length;
      const end = field.selectionEnd ?? start;
      const selected = value.slice(start, end) || "text";
      const nextValue = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;

      form.setValue("description", nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });

      requestAnimationFrame(() => {
        field.focus();
        const nextStart = start + prefix.length;
        field.setSelectionRange(nextStart, nextStart + selected.length);
      });
    },
    [form],
  );

  const insertDescriptionText = React.useCallback(
    (text: string) => {
      const field = descriptionRef.current;
      const value = form.getValues("description") ?? "";
      if (!field) return;
      const start = field.selectionStart ?? value.length;
      const end = field.selectionEnd ?? start;
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      form.setValue("description", nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
      requestAnimationFrame(() => {
        field.focus();
        const cursor = start + text.length;
        field.setSelectionRange(cursor, cursor);
      });
    },
    [form],
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 p-4">
        <div className="space-y-2">
          <Label htmlFor="name">Title</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Short sleeve t-shirt"
            className="bg-white text-lg"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">
              {(form.formState.errors.name as { message?: string })?.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <div className="relative">
            <div className="flex h-10 items-center gap-1 overflow-x-auto rounded-t-md border border-b-0 border-[#d2d5d9] bg-[#f6f6f7] px-2">
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Formatting options"
                title="Formatting options"
              >
                ☷
              </button>
              <button
                type="button"
                className="h-7 whitespace-nowrap rounded px-2 text-xs hover:bg-white"
                aria-label="Paragraph"
              >
                Paragraph⌄
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs font-semibold hover:bg-white"
                aria-label="Bold"
                onClick={() => applyDescriptionFormat("**")}
              >
                B
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs italic hover:bg-white"
                aria-label="Italic"
                onClick={() => applyDescriptionFormat("*")}
              >
                I
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs underline hover:bg-white"
                aria-label="Underline"
                onClick={() => applyDescriptionFormat("__")}
              >
                U
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Link"
                onClick={() => applyDescriptionFormat("[", "](https://)")}
              >
                🔗
              </button>
              <span className="mx-1 h-5 w-px bg-[#d2d5d9]" />
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Text color"
              >
                A⌄
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Alignment"
              >
                ☰⌄
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Insert image"
              >
                ▧
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Insert video"
              >
                ▷
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Insert table"
              >
                ▦⌄
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Bulleted list"
                onClick={() => insertDescriptionText("\n- ")}
              >
                •
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Numbered list"
                onClick={() => insertDescriptionText("\n1. ")}
              >
                1.
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Outdent"
              >
                ⇤
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Indent"
              >
                ⇥
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs hover:bg-white"
                aria-label="Clear formatting"
                onClick={() => {
                  const field = descriptionRef.current;
                  const value = form.getValues("description") ?? "";
                  if (!field) return;
                  const start = field.selectionStart ?? 0;
                  const end = field.selectionEnd ?? start;
                  const selected = value.slice(start, end).replace(/[\*_]/g, "");
                  form.setValue(
                    "description",
                    `${value.slice(0, start)}${selected}${value.slice(end)}`,
                    { shouldDirty: true, shouldValidate: true },
                  );
                }}
              >
                ⊘
              </button>
              <button
                type="button"
                className="h-7 rounded px-2 text-xs font-mono hover:bg-white"
                aria-label="Show HTML"
              >
                &lt;/&gt;
              </button>
            </div>
            <Textarea
              id="description"
              {...descriptionField}
              ref={(node) => {
                descriptionRef.current = node;
                descriptionField.ref(node);
              }}
              rows={8}
              placeholder="Describe your product..."
              className="min-h-[154px] rounded-t-none border-[#d2d5d9] bg-white pt-3"
            />
          </div>
          {form.formState.errors.description && (
            <p className="text-sm text-destructive">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[#8c9196] p-5 text-center">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMediaPickerOpen(true)}
              >
                Upload new
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMediaPickerOpen(true)}
              >
                Select existing
              </Button>
            </div>
            <p className="text-xs text-[#616161]">
              Accepts images, videos, or 3D models
            </p>
            {selectedMedia.length > 0 && (
              <span className="text-xs text-[#616161]">
                {selectedMedia.length} media selected
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category_id">Category</Label>
          <Select
            className="w-full"
            value={form.watch("category_id") || ""}
            onValueChange={(v) => form.setValue("category_id", v || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>Choose a product category</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No category</SelectItem>
              {categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  disabled={category.status !== "active"}
                >
                  {category.name}
                  {category.status !== "active" && " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determines tax rates and adds metafields to improve search,
            filters, and cross-channel sales.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
