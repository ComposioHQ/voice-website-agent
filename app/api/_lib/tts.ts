import { getOpenAI } from "../_lib/openaiClient";

const MAX_TTS_CHARS = 6000; // heuristic

export async function synthesizeSpeech(inputText: string) {
  const openai = getOpenAI();

  let ttsInput = inputText;
  if (ttsInput.length > MAX_TTS_CHARS) {
    try {
      const condensed = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "Rewrite the content as a concise spoken summary under 120 words. Plain text only.",
          },
          { role: "user", content: inputText },
        ],
      });
      ttsInput =
        condensed.choices?.[0]?.message?.content?.trim?.() ??
        inputText.slice(0, MAX_TTS_CHARS);
    } catch {
      ttsInput = inputText.slice(0, MAX_TTS_CHARS);
    }
    if (ttsInput.length > MAX_TTS_CHARS) {
      ttsInput = ttsInput.slice(0, MAX_TTS_CHARS);
    }
  }

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: ttsInput || "I could not generate a response.",
  });

  const audioArrayBuffer = await speech.arrayBuffer();
  const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");
  return { audioBase64, mimeType: "audio/mpeg" };
}


