import { AIResult } from "@/result";
import { validateMessages } from "@/utils/message";
import { LLMHistoryCompactor, type LLMHistoryCompactionPolicy } from "@/history";
import type { LLMMessage, LLMMessageText, LLMGenerateRequest } from "@/provider";

import type { LLMPromptBuildResult, LLMPromptBuildOptions } from "./interface";

export class LLMPromptBuilder {
  private readonly system?: string | string[];
  private readonly historyCompactor?: LLMHistoryCompactor;

  constructor(system?: string | string[], history?: LLMHistoryCompactionPolicy) {
    this.system = system;
    this.historyCompactor = history ? new LLMHistoryCompactor(history) : undefined;
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
    options: LLMPromptBuildOptions
  ): Promise<AIResult<Undefinable<LLMPromptBuildResult["context"]>>> {
    let context: LLMPromptBuildResult["context"];
    if (options.context) {
      const { composer, maxChars, metadata, defaultRole, conversationID } = options.context;
      const contextResult = await composer.compose({
        maxChars,
        metadata,
        defaultRole,
        conversationID,
        signal: options.signal
      });
      if (contextResult.isErr()) return contextResult;

      context = contextResult.unwrap();
    }
    return AIResult.ok(context);
  }

  private buildTools(options: LLMPromptBuildOptions, request: LLMGenerateRequest) {
    if (options.tools) {
      request.tools = options.tools.registry.definitions(
        options.tools.strict,
        options.tools.selectedNames
      );
      request.toolChoice = options.tools.choice;
    }
  }

  private buildInstructions(options: LLMPromptBuildOptions): AIResult<LLMMessageText[]> {
    const messages: LLMMessageText[] = [];
    for (const instruction of options.instructions ?? []) {
      const message = this.buildText(instruction, "system", "request instruction");
      if (message.isErr()) return message;
      messages.push(message.unwrap());
    }
    return AIResult.ok(messages);
  }

  async build(options: LLMPromptBuildOptions): Promise<AIResult<LLMPromptBuildResult>> {
    const prefixMessages: LLMMessage[] = [];

    // 构建系统提示词
    const systemResult = this.buildSystem(prefixMessages);
    if (systemResult.isErr()) return systemResult;

    // 构建上下文
    const contextResult = await this.buildContext(options);
    if (contextResult.isErr()) return contextResult;
    const context = contextResult.unwrap();
    const contextPlacement = options.context?.placement ?? "prefix";
    const instructionsResult = this.buildInstructions(options);
    if (instructionsResult.isErr()) return instructionsResult;
    const transientMessages = [
      ...instructionsResult.unwrap(),
      ...(contextPlacement === "before_user" ? structuredClone(context?.messages ?? []) : [])
    ];
    if (contextPlacement === "prefix" && context) prefixMessages.push(...context.messages);

    const history = validateMessages(options.conversation.toMessages());
    if (history.isErr()) return history;

    const inputResult = this.buildText(options.input, "user", "user input");
    if (inputResult.isErr()) return inputResult;
    const userMessage = inputResult.unwrap();

    let request: LLMGenerateRequest = {
      messages: [],
      signal: options.signal,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens
    };

    // 构建工具定义
    this.buildTools(options, request);

    let historyBudget: LLMPromptBuildResult["historyBudget"];
    let historyResult: LLMPromptBuildResult["history"];
    if (this.historyCompactor) {
      if (!options.historyRuntime) {
        return AIResult.err({
          type: "invalid_prompt_config",
          message: "history compaction 缺少 summarize runtime"
        });
      }

      const baseRequest: Omit<LLMGenerateRequest, "messages"> = {
        signal: request.signal,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        toolChoice: request.toolChoice,
        tools: request.tools
      };
      historyBudget = this.historyCompactor.createBudget({
        request: baseRequest,
        conversation: options.conversation,
        prefixMessages,
        contextWindowTokens: options.contextWindowTokens,
        outputReserveTokens: options.maxOutputTokens,
        summarize: options.historyRuntime.summarize
      });
      const fitted = await historyBudget.fit([...transientMessages, userMessage]);
      if (fitted.isErr()) return fitted;
      historyResult = fitted.unwrap();
      request = historyResult.request;
    } else {
      request.messages = [
        ...prefixMessages,
        ...history.unwrap(),
        ...transientMessages,
        userMessage
      ];
    }

    // 验证消息
    const validation = validateMessages(request.messages);
    if (validation.isErr()) return validation;

    return AIResult.ok({
      request,
      context,
      userMessage,
      ...(transientMessages.length ? { transientMessages } : {}),
      ...(historyResult ? { history: historyResult } : {}),
      ...(historyBudget ? { historyBudget } : {})
    });
  }
}
