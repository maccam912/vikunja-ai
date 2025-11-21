import OpenAI from "openai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ChatCompletionResult {
  message: string;
  toolCalls: ToolCall[];
  finishReason: string;
}

export class OpenRouterClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = "anthropic/claude-3.5-sonnet") {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/democratize-technology/vikunja-ai",
        "X-Title": "Vikunja AI Assistant",
      },
    });
    this.model = model;
  }

  /**
   * Send a chat completion request with function calling support
   */
  async chatCompletion(
    messages: ChatMessage[],
    tools?: any[],
    systemPrompt?: string
  ): Promise<ChatCompletionResult> {
    try {
      // Add system prompt if provided
      const allMessages = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...messages]
        : messages;

      const params: any = {
        model: this.model,
        messages: allMessages,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        params.tools = tools;
        params.tool_choice = "auto";
      }

      console.log("[OpenRouter] Sending request:", {
        model: this.model,
        messageCount: allMessages.length,
        toolCount: tools?.length || 0,
      });

      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      const message = choice.message;

      // Extract tool calls if any
      const toolCalls: ToolCall[] = [];
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          if (tc.type === "function") {
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments),
            });
          }
        }
      }

      return {
        message: message.content || "",
        toolCalls,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      console.error("[OpenRouter] API error:", error);
      throw new Error(`OpenRouter API failed: ${(error as Error).message}`);
    }
  }

  /**
   * Multi-step chat with automatic tool execution
   */
  async chatWithTools(
    messages: ChatMessage[],
    tools: any[],
    toolExecutor: (name: string, args: any) => Promise<any>,
    systemPrompt?: string,
    maxSteps: number = 10
  ): Promise<{
    finalMessage: string;
    allToolCalls: Array<{ name: string; args: any; result: any }>;
    conversationHistory: ChatMessage[];
  }> {
    const conversationHistory: ChatMessage[] = [...messages];
    const allToolCalls: Array<{ name: string; args: any; result: any }> = [];
    let stepCount = 0;

    while (stepCount < maxSteps) {
      stepCount++;
      console.log(`[OpenRouter] Step ${stepCount}/${maxSteps}`);

      const result = await this.chatCompletion(
        conversationHistory,
        tools,
        systemPrompt
      );

      // If no tool calls, we're done
      if (result.toolCalls.length === 0) {
        return {
          finalMessage: result.message,
          allToolCalls,
          conversationHistory,
        };
      }

      // Add assistant message with tool calls to history
      conversationHistory.push({
        role: "assistant",
        content: result.message || "Executing tools...",
      });

      // Execute all tool calls
      for (const toolCall of result.toolCalls) {
        console.log(`[OpenRouter] Executing tool: ${toolCall.name}`, toolCall.arguments);

        try {
          const toolResult = await toolExecutor(toolCall.name, toolCall.arguments);

          allToolCalls.push({
            name: toolCall.name,
            args: toolCall.arguments,
            result: toolResult,
          });

          // Add tool result to conversation
          conversationHistory.push({
            role: "user",
            content: `Tool ${toolCall.name} result: ${JSON.stringify(toolResult)}`,
          });
        } catch (error) {
          console.error(`[OpenRouter] Tool execution failed:`, error);
          conversationHistory.push({
            role: "user",
            content: `Tool ${toolCall.name} failed: ${(error as Error).message}`,
          });
        }
      }
    }

    // Max steps reached
    return {
      finalMessage: "I reached the maximum number of steps. Please try breaking down your request.",
      allToolCalls,
      conversationHistory,
    };
  }

  /**
   * Update the model being used
   */
  setModel(model: string): void {
    this.model = model;
    console.log(`[OpenRouter] Model updated to: ${model}`);
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }
}
