"use client";

import * as React from "react";

export function useProductSelection(filteredProductIds: string[]) {
  const [selectedProducts, setSelectedProducts] = React.useState<string[]>([]);

  const allSelected =
    filteredProductIds.length > 0 &&
    filteredProductIds.every((id) => selectedProducts.includes(id));
  const someSelected = selectedProducts.length > 0 && !allSelected;

  const handleSelectAll = (checked?: boolean) => {
    const select = checked ?? !allSelected;
    if (!select) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts([...filteredProductIds]);
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isSelected = (id: string) => selectedProducts.includes(id);

  const handleClearSelection = () => setSelectedProducts([]);

  return {
    selectedProducts,
    setSelectedProducts,
    allSelected,
    someSelected,
    handleSelectAll,
    handleSelectProduct,
    isSelected,
    handleClearSelection,
  };
}
