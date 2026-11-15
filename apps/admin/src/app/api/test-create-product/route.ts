import { NextResponse } from "next/server";
import { createProduct } from "@/app/(dashboard)/products/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createProduct(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Test create product error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}