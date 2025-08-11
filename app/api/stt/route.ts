import { NextResponse } from "next/server";
import { transcribeAudioFile } from "../_lib/stt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    const transcript = await transcribeAudioFile(audioFile);
    return NextResponse.json({ transcript });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


