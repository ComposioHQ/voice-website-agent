import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type ChatRole = "system" | "user" | "assistant" | "tool";
export type ChatMessage = { role: ChatRole; content: string };

// Lightweight global conversation state shared across requests
export const globalMessages: ChatMessage[] = [
  {
    role: "system",
    content:
      "You are GPT-5, a concise, helpful assistant focused on website creation tasks. Keep answers short and actionable.",
  },
];

export function toOpenAIMessages(
  messages: ChatMessage[]
): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "system",
        content: `TOOL_RESULT\n${m.content}`,
      } as ChatCompletionMessageParam;
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    } as ChatCompletionMessageParam;
  });
}


