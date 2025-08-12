import { getOpenAI } from "../_lib/openaiClient";
import { composio, ensureToolsRegistered } from "../_lib/composioTools";
import { globalMessages, toOpenAIMessages } from "../_lib/agentState";

export async function runAgentWithTools(userText: string): Promise<string> {
  await ensureToolsRegistered();
  const openai = getOpenAI();

  // Track message history globally
  globalMessages.push({ role: "user", content: userText });

  const tools = await composio.tools.get("default", {
    tools: [
      "WRITE_FULL_HTML_PREVIEW",
      "NOTION_FETCH_DATA",
      "NOTION_FETCH_BLOCK_CONTENTS"
    ],
  });

  // Keep calling the LLM and executing tool calls until none remain
  let finalAssistantTurn = "";
  const maxIterations = 8;
  // Maintain a local message array in OpenAI-native format so tool_call_id is preserved
  let localMessages = toOpenAIMessages(globalMessages);
  for (let i = 0; i < maxIterations; i++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: localMessages,
      tools: tools,
    });

    const assistantMsg = completion.choices?.[0]?.message as any;
    const assistantText = assistantMsg?.content || "";

    // Track for final response and UI history
    if (assistantText) {
      globalMessages.push({ role: "assistant", content: assistantText });
      finalAssistantTurn = assistantText;
    }

    // Append the assistant message including tool_calls to local history
    localMessages = [
      ...localMessages,
      {
        role: "assistant",
        content: assistantText || "",
        tool_calls: assistantMsg?.tool_calls || undefined,
      } as any,
    ];

    const toolCalls = assistantMsg?.tool_calls as Array<any> | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      break;
    }

    // Execute tool calls via Composio
    const executionResult = await composio.provider.handleToolCalls("default", completion);

    // Map results back to tool_call_id
    try {
      if (Array.isArray(executionResult) && executionResult.length === toolCalls.length) {
        for (let idx = 0; idx < toolCalls.length; idx++) {
          const call = toolCalls[idx];
          const resultForCall = executionResult[idx];
          const resultStr = typeof resultForCall === "string" ? resultForCall : JSON.stringify(resultForCall);
          // Append to local messages with correct role/tool_call_id for the model to consume next turn
          localMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: resultStr,
          } as any);
          // Also keep a condensed record in global history
          globalMessages.push({ role: "tool", content: resultStr });
        }
      } else if (toolCalls.length === 1) {
        const singleId = toolCalls[0].id;
        const resultStr = typeof executionResult === "string" ? executionResult : JSON.stringify(executionResult);
        localMessages.push({
          role: "tool",
          tool_call_id: singleId,
          content: resultStr,
        } as any);
        globalMessages.push({ role: "tool", content: resultStr });
      } else {
        // Fallback: attach a generic tool result so the model can proceed
        const resultStr = typeof executionResult === "string" ? executionResult : JSON.stringify(executionResult);
        localMessages.push({ role: "system", content: `TOOL_RESULT\n${resultStr}` } as any);
        globalMessages.push({ role: "tool", content: resultStr });
      }
    } catch {
      localMessages.push({ role: "system", content: "TOOL_RESULT\n[tool executed]" } as any);
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
    rewrite.choices?.[0]?.message?.content?.trim?.() || summaryText || finalAssistantTurn || "";

  return finalAssistantText;
}


