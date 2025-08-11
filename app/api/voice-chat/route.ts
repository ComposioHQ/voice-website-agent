import { NextResponse } from "next/server";
import { transcribeAudioFile } from "../_lib/stt";
import { runAgentWithTools } from "../_lib/agent";
import { synthesizeSpeech } from "../_lib/tts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // 1) STT
    const transcript = await transcribeAudioFile(audioFile);

    // 2) Agent + Tools
    const assistantText = await runAgentWithTools(transcript);

    // 3) TTS
    const { audioBase64, mimeType } = await synthesizeSpeech(assistantText);

    return NextResponse.json({
      transcript,
      text: assistantText,
      audioBase64,
      mimeType,
    });
  } catch (error: any) {
    console.error("/api/voice-chat error", error);
    return NextResponse.json(
      { error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


