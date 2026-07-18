import type { LLMMessage, LLMGenerateRequest } from "@/provider/interface";

import type { LLMTokenEstimator } from "./interface";

const MessageFrameTokens = 8;
const RequestFrameTokens = 16;
const ToolCallFrameTokens = 12;

/**
 * 与模型服务提供方无关的保守估算；可通过策略注入精确的分词器。
 * 使用 UTF-8 字节数而非字符数，避免低估中日韩文字、JSON 和符号占用的令牌数量。
 */
export class LLMConservativeTokenEstimator implements LLMTokenEstimator {
  private readonly encoder = new TextEncoder();

  estimateText(text: string): number {
    if (!text) return 0;
    return Math.ceil(this.encoder.encode(text).byteLength / 2.5);
  }

  estimateMessages(messages: readonly LLMMessage[]): number {
    let tokens = 0;

    for (const message of messages) {
      tokens += MessageFrameTokens + this.estimateText(message.role);

      if (message.role === "tool") {
        tokens += this.estimateText(message.name);
        tokens += this.estimateText(message.callID);
        tokens += this.estimateText(message.content);
        continue;
      }

      if (message.role === "assistant" && "toolCalls" in message) {
        tokens += this.estimateText(message.content ?? "");
        if (message.providerContext) {
          tokens += this.estimateText(JSON.stringify(message.providerContext));
        }
        for (const call of message.toolCalls) {
          tokens += ToolCallFrameTokens;
          tokens += this.estimateText(call.name);
          tokens += this.estimateText(call.callID);
          tokens += this.estimateText(call.arguments);
        }
        continue;
      }

      tokens += this.estimateText(message.content);
    }

    return tokens;
  }

  estimateRequest(request: LLMGenerateRequest): number {
    let tokens = RequestFrameTokens + this.estimateMessages(request.messages);

    if (request.tools?.length) {
      tokens += this.estimateText(JSON.stringify(request.tools));
      tokens += request.tools.length * ToolCallFrameTokens;
    }
    if (request.toolChoice !== undefined) {
      tokens += this.estimateText(JSON.stringify(request.toolChoice));
    }

    return tokens;
  }
}
