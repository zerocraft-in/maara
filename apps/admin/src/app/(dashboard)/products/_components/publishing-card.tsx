"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PublishingCard() {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="border-b px-0 pb-3 pt-0">
        <CardTitle className="text-sm font-semibold">
          Publishing
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pt-3">
        <Select className="w-full" defaultValue="all">
          <SelectTrigger className="w-full bg-white">
            <SelectValue>All channels</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
