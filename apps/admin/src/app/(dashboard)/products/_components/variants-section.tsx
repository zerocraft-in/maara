"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VariantEditor } from "@/app/(dashboard)/products/_components/variant-editor";

export function VariantsSection() {
  return (
    <div className="space-y-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Variants</CardTitle>
      </CardHeader>
      <Card>
        <CardContent>
          <VariantEditor onVariantChange={() => {}} />
        </CardContent>
      </Card>
    </div>
  );
}
