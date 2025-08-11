import { NextResponse } from "next/server";
import { synthesizeSpeech } from "../_lib/tts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    const { audioBase64, mimeType } = await synthesizeSpeech(text);
    return NextResponse.json({ audioBase64, mimeType });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


