import { getOpenAI } from "../_lib/openaiClient";
import { composio, ensureToolsRegistered } from "../_lib/composioTools";
import { globalMessages, toOpenAIMessages } from "../_lib/agentState";

export async function runAgentWithTools(userText: string): Promise<string> {
  await ensureToolsRegistered();
  const openai = getOpenAI();

  // Track message history globally
  globalMessages.push({ role: "user", content: userText });

  const tools = await composio.tools.get("default", {
    tools: ["WRITE_FULL_HTML_PREVIEW"],
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: toOpenAIMessages(globalMessages),
    tools: tools,
  });

  const rawAssistant = completion.choices?.[0]?.message?.content || "";
  if (rawAssistant) {
    globalMessages.push({ role: "assistant", content: rawAssistant });
  }

  if (completion.choices?.[0]?.message?.tool_calls) {
    const result = await composio.provider.handleToolCalls("default", completion);
    try {
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      globalMessages.push({ role: "tool", content: resultStr });
    } catch {
      globalMessages.push({ role: "tool", content: "[tool executed]" });
    }
  }

  const toolCallSummary = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      ...toOpenAIMessages(globalMessages),
      {
        role: "system",
        content:
          "Summarize any tool calls that occurred and update your answer accordingly. Keep it short.",
      },
    ],
  });

  const summaryText = toolCallSummary.choices?.[0]?.message?.content?.trim?.() || "";
  if (summaryText) {
    globalMessages.push({ role: "assistant", content: summaryText });
  }

  // Ask for a rewrite to be crisp and actionable
  const rewrite = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      ...toOpenAIMessages(globalMessages),
      {
        role: "system",
        content:
          "Rewrite the last assistant response to be crisp, actionable, and suitable for voice. Max 100 words.",
      },
    ],
  });

  const finalAssistantText =
    rewrite.choices?.[0]?.message?.content?.trim?.() || summaryText || rawAssistant || "";

  return finalAssistantText;
}


