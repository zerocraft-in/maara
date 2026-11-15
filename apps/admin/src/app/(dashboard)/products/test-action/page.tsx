"use client";

import * as React from "react";
import { archiveProduct } from "../actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function TestActionPage() {
  const [result, setResult] = React.useState<string>("");

  const testArchive = async () => {
    try {
      const res = await archiveProduct({ id: "026e39b1-ec42-474c-917e-1a104459b096" });
      setResult(JSON.stringify(res, null, 2));
      if (res.ok) {
        toast.success("Archive succeeded!");
      } else {
        toast.error(res.error);
      }
    } catch (error) {
      setResult(String(error));
      toast.error(String(error));
    }
  };

  return (
    <div className="p-8">
      <Button onClick={testArchive}>Test Archive</Button>
      <pre className="mt-4 p-4 bg-gray-100 rounded">{result}</pre>
    </div>
  );
}