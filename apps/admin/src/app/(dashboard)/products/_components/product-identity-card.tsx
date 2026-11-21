"use client";

import * as React from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryOption } from "../types";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";
import { RichTextEditor } from "@/components/tiptap/rich-text-editor";

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
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <RichTextEditor
                id="description"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={!!fieldState.error}
                placeholder="Describe your product..."
              />
            )}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-destructive">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {selectedMedia.length > 0 ? (
              selectedMedia.map((media, index) => (
                <button
                  key={media.id || media.url}
                  type="button"
                  onClick={() => setMediaPickerOpen(true)}
                  className={index === 0
                    ? "relative h-60 w-60 overflow-hidden rounded-xl border border-[#c9c9c9] bg-[#f6f6f6]"
                    : "relative h-28 w-28 overflow-hidden rounded-xl border border-[#c9c9c9] bg-[#f6f6f6]"}
                  aria-label={`Edit ${media.name}`}
                >
                  <img src={media.url} alt={media.name} className="h-full w-full object-cover" />
                </button>
              ))
            ) : null}
            <button
              type="button"
              onClick={() => setMediaPickerOpen(true)}
              className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-[#8c9196] text-2xl text-[#616161] transition-colors hover:bg-[#f6f6f6]"
              aria-label="Add media"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setMediaPickerOpen(true)}>Upload new</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMediaPickerOpen(true)}>Select existing</Button>
            <p className="text-xs text-[#616161]">Accepts images, videos, or 3D models</p>
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
            Determines tax rates and adds metafields to improve search, filters,
            and cross-channel sales.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
