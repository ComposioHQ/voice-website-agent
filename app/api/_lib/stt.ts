import { getOpenAI } from "../_lib/openaiClient";

export async function transcribeAudioFile(audioFile: File): Promise<string> {
  const openai = getOpenAI();
  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile as any,
  });
  const userText = (transcription as any).text?.trim?.() ?? "";
  if (!userText) {
    throw new Error("Transcription failed");
  }
  return userText;
}


