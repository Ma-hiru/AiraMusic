import { AIResult } from "@/result";
import { validateMessages } from "@/utils/message";
import type { LLMMessage, LLMMessageText, LLMGenerateRequest } from "@/provider";

import type { LLMPromptBuildResult, LLMPromptBuildOptions } from "./interface";

export class LLMPromptBuilder {
  private readonly system?: string | string[];

  constructor(system?: string | string[]) {
    this.system = system;
  }

  private buildText(
    content: string,
    role: LLMMessageText["role"],
    label: string
  ): AIResult<LLMMessageText> {
    const normalized = content.trim();
    if (!normalized) {
      return AIResult.err({
        type: "invalid_prompt_config",
        message: `${label} 内容为空`
      });
    }

    return AIResult.ok({ role, content: normalized });
  }

  private buildSystem(messages: LLMMessage[]): AIResult<void> {
    if (this.system !== undefined) {
      const systems: LLMMessageText[] = [];

      for (const item of Array.isArray(this.system) ? this.system : [this.system]) {
        const messageResult = this.buildText(item, "system", "system prompt");
        if (messageResult.isErr()) return messageResult;
        systems.push(messageResult.unwrap());
      }

      messages.push(...systems);
    }
    return AIResult.ok(undefined);
  }

  private async buildContext(
    options: LLMPromptBuildOptions,
    messages: LLMMessage[]
  ): Promise<AIResult<Undefinable<LLMPromptBuildResult["context"]>>> {
    let context: LLMPromptBuildResult["context"];
    if (options.context) {
      const { composer, ...composeOptions } = options.context;
      const contextResult = await composer.compose({
        ...composeOptions,
        signal: options.signal
      });
      if (contextResult.isErr()) return contextResult;

      context = contextResult.unwrap();
      messages.push(...context.messages);
    }
    return AIResult.ok(context);
  }

  private buildTools(options: LLMPromptBuildOptions, request: LLMGenerateRequest) {
    if (options.tools) {
      request.tools = options.tools.registry.definitions(options.tools.strict);
      request.toolChoice = options.tools.choice;
    }
  }

  private buildRequest(
    options: LLMPromptBuildOptions,
    messages: LLMMessage[]
  ): AIResult<LLMGenerateRequest> {
    const history = validateMessages(options.conversation.toMessages());
    if (history.isErr()) return history;
    messages.push(...history.unwrap());

    const input = this.buildText(options.input, "user", "user input");
    if (input.isErr()) return input;
    messages.push(input.unwrap());

    return AIResult.ok({
      messages,
      signal: options.signal,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens
    });
  }

  async build(options: LLMPromptBuildOptions): Promise<AIResult<LLMPromptBuildResult>> {
    const messages: LLMMessage[] = [];

    // 构建系统提示词
    const systemResult = this.buildSystem(messages);
    if (systemResult.isErr()) return systemResult;

    // 构建上下文
    const contextResult = await this.buildContext(options, messages);
    if (contextResult.isErr()) return contextResult;
    const context = contextResult.unwrap();

    // 构建请求
    const requestResult = this.buildRequest(options, messages);
    if (requestResult.isErr()) return requestResult;
    const request = requestResult.unwrap();

    // 构建tools
    this.buildTools(options, request);

    // 验证消息
    const validation = validateMessages(messages);
    if (validation.isErr()) return validation;

    return AIResult.ok({ request, context });
  }
}
