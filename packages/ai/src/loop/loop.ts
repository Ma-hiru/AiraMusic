import { AIResult } from "@/result";
import type { LLMToolCall, LLMToolResult } from "@/tools";
import type { LLMMessageText, LLMGenerateRequest } from "@/provider";

import type { LLMLoopStep, LLMLoopOptions, LLMLoopRunResult, LLMLoopRunOptions } from "./interface";

export class LLMLoop<TConfig> {
  private readonly config: TConfig;
  private readonly maxSteps: number;
  private readonly prompt: LLMLoopOptions<TConfig>["prompt"];
  private readonly provider: LLMLoopOptions<TConfig>["provider"];

  constructor(options: LLMLoopOptions<TConfig>) {
    this.config = options.config;
    this.prompt = options.prompt;
    this.provider = options.provider;
    this.maxSteps = options.maxSteps;
  }

  async run(options: LLMLoopRunOptions): Promise<AIResult<LLMLoopRunResult>> {
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 1) {
      return AIResult.err({
        type: "invalid_config",
        message: "loop maxSteps 必须是大于 0 的整数"
      });
    }

    const promptResult = await this.prompt.build(options);
    if (promptResult.isErr()) return promptResult;

    const built = promptResult.unwrap();
    const initialHistoryLength = options.conversation.toMessages().length;
    const prefixLength = built.request.messages.length - initialHistoryLength - 1;
    if (prefixLength < 0) {
      return AIResult.err({
        type: "invalid_prompt_config",
        message: "prompt messages 与 conversation/input 不匹配"
      });
    }

    const prefix = built.request.messages.slice(0, prefixLength);
    const userMessage = built.request.messages.at(-1);
    if (!userMessage || userMessage.role !== "user" || !("content" in userMessage)) {
      return AIResult.err({
        type: "invalid_prompt_config",
        message: "prompt 缺少当前 user message"
      });
    }

    const appendedUser = options.conversation.appendMessage(userMessage as LLMMessageText);
    if (appendedUser.isErr()) return appendedUser;

    const steps: LLMLoopStep[] = [];
    let request: LLMGenerateRequest = built.request;

    for (let index = 0; index < this.maxSteps; index++) {
      if (options.signal.aborted) {
        return AIResult.err({
          type: "aborted",
          message: "loop aborted"
        });
      }

      const responseResult = await this.provider.generate(this.config, request);
      if (responseResult.isErr()) return responseResult;

      const response = responseResult.unwrap();
      if (!response.toolCalls.length) {
        const appendedAssistant = options.conversation.appendMessage({
          role: "assistant",
          content: response.text
        });
        if (appendedAssistant.isErr()) return appendedAssistant;

        steps.push({ response, toolResults: [] });
        return AIResult.ok({ response, steps, context: built.context });
      }

      if (!options.tools) {
        return AIResult.err({
          type: "invalid_tool_call",
          message: "模型返回了 tool call，但 loop 没有配置 tools"
        });
      }

      const appendedToolCall = options.conversation.appendMessage({
        role: "assistant",
        content: response.text || undefined,
        toolCalls: response.toolCalls
      });
      if (appendedToolCall.isErr()) return appendedToolCall;

      const toolResults: LLMToolResult[] = [];
      for (const call of response.toolCalls) {
        const toolResult = await options.tools.registry.execute(call, {
          signal: options.signal,
          conversationID: options.conversation.id
        });

        let result: LLMToolResult;
        if (toolResult.isErr()) {
          result = this.buildToolError(call, toolResult.reason);
        } else {
          result = toolResult.unwrap();
        }
        const appendedToolResult = options.conversation.appendMessage({
          role: "tool",
          name: result.name,
          callID: result.callID,
          content: result.output
        });
        if (appendedToolResult.isErr()) return appendedToolResult;
        toolResults.push(result);
      }

      steps.push({ response, toolResults });
      request = {
        ...built.request,
        messages: [...prefix, ...options.conversation.toMessages()]
      };
    }

    return AIResult.err({
      type: "bad_response",
      message: `loop 达到最大步数仍未生成最终回复：${this.maxSteps}`
    });
  }

  private buildToolError(
    call: LLMToolCall,
    error: { type: string; message: string }
  ): LLMToolResult {
    const raw = {
      error: {
        type: error.type,
        message: error.message
      },
      call
    };

    return {
      raw,
      name: call.name,
      callID: call.callID,
      output: JSON.stringify(raw)
    };
  }
}
