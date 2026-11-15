import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { productId } = await request.json();
    
    const supabase = await createServerSupabaseClient();
    
    // Test getUser
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User:", user, "Error:", userError);
    
    if (!user) {
      return NextResponse.json({ error: "No user" }, { status: 401 });
    }
    
    // Test RPC
    const { error: rpcError } = await supabase.rpc("archive_product", {
      p_product_id: productId,
    });
    
    console.log("RPC Error:", rpcError);
    
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test archive error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}