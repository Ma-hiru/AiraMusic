import { AIError, AIResult } from "@/result";
import { LLMProvider, type LLMProviderConfig } from "@/provider/interface";
import type { LLMToolCall, LLMToolResult } from "@/tools";
import type {
  LLMMessage,
  LLMGenerateRequest,
  LLMMessageToolCall,
  LLMGenerateResponse
} from "@/provider";

import type {
  LLMLoopStep,
  LLMLoopEvent,
  LLMLoopRunStream,
  LLMLoopRunOptions,
  LLMLoopEventResponse
} from "./interface";

export class LLMLoop {
  static async *run<TConfig extends LLMProviderConfig>(
    options: LLMLoopRunOptions<TConfig>
  ): LLMLoopRunStream {
    const promptResult = await options.promptBuilder.build(options);
    if (promptResult.isErr()) {
      yield promptResult;
      return promptResult;
    }

    const prompt = promptResult.unwrap();
    const steps: LLMLoopStep[] = [];
    const turnMessages: LLMMessage[] = [prompt.userMessage];
    let request: LLMGenerateRequest = prompt.request;

    for (let index = 0; index < options.maxSteps; index++) {
      if (options.signal.aborted) {
        const aborted = AIResult.err({
          type: "aborted",
          message: "loop aborted"
        });
        yield aborted;
        return aborted;
      }

      const responseResult = yield* this.runStream(
        options.provider,
        options.config,
        request,
        index
      );
      if (responseResult.isErr()) {
        yield responseResult;
        return responseResult;
      }

      const response = responseResult.unwrap();
      // 没有 tool call 说明已经生成最终回复
      if (!response.toolCalls.length) {
        const finalMessages: LLMMessage[] = [
          ...turnMessages,
          { role: "assistant", content: response.text }
        ];
        steps.push({ response, toolResults: [] });

        yield AIResult.ok({
          step: index,
          type: "done",
          response: this.toEventResponse(response),
          messages: structuredClone(finalMessages),
          ...(prompt.context ? { context: prompt.context } : {})
        });
        return AIResult.ok({
          response,
          steps,
          context: prompt.context,
          messages: finalMessages
        });
      }
      if (!options.tools) {
        const noTools = AIResult.err({
          type: "invalid_tool_call",
          message: "模型返回了 tool call，但 loop 没有配置 tools"
        });
        yield noTools;
        return noTools;
      }

      const toolCallMessage: LLMMessageToolCall = response.text
        ? { role: "assistant", content: response.text, toolCalls: response.toolCalls }
        : { role: "assistant", toolCalls: response.toolCalls };
      yield AIResult.ok({
        step: index,
        type: "tool_call",
        message: structuredClone(toolCallMessage),
        toolCalls: structuredClone(response.toolCalls),
        ...(response.text ? { text: response.text } : {})
      });

      const toolResults: LLMToolResult[] = [];
      const toolMessages: LLMMessage[] = [];

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

        toolResults.push(result);
        toolMessages.push({
          role: "tool",
          name: result.name,
          callID: result.callID,
          content: result.output
        });
      }

      turnMessages.push(toolCallMessage, ...toolMessages);
      steps.push({ response, toolResults });
      yield AIResult.ok({
        step: index,
        type: "tool_result",
        toolResults,
        messages: structuredClone(turnMessages)
      });

      // 更新 request 准备下一次循环
      request = {
        ...prompt.request,
        messages: [
          ...prompt.request.messages,
          // 去掉 user message 因为 request.messages 已经包含了
          ...turnMessages.slice(1)
        ]
      };
    }

    const maxStepError = AIResult.err({
      type: "bad_response",
      message: `loop 达到最大步数仍未生成最终回复：${options.maxSteps}`
    });
    yield maxStepError;
    return maxStepError;
  }

  private static buildToolError(call: LLMToolCall, error: AIError): LLMToolResult {
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

  private static async *runStream<TConfig extends LLMProviderConfig>(
    provider: LLMProvider<TConfig>,
    config: TConfig,
    request: LLMGenerateRequest,
    step: number
  ): AsyncGenerator<AIResult<LLMLoopEvent>, AIResult<LLMGenerateResponse>> {
    for await (const eventResult of provider.stream(config, request)) {
      if (eventResult.isErr()) return eventResult;

      const event = eventResult.unwrap();
      if (event.type === "text_delta") {
        yield AIResult.ok({ step, type: "text_delta", text: event.text });
        continue;
      }

      return AIResult.ok(event);
    }

    return AIResult.err({
      type: "bad_response",
      message: "provider stream 缺少 done 事件"
    });
  }

  private static toEventResponse(response: LLMGenerateResponse): LLMLoopEventResponse {
    return {
      text: response.text,
      usage: response.usage,
      toolCalls: structuredClone(response.toolCalls),
      finishReason: response.finishReason
    };
  }
}
