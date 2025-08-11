import { NextResponse } from "next/server";
import { runAgentWithTools } from "../_lib/agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    const result = await runAgentWithTools(text);
    return NextResponse.json({ text: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


