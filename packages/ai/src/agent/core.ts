import { LLMProvider } from "@/provider";
import { LLMToolRegistry } from "@/tools";
import { AIError, AIResult } from "@/result";
import { LLMContextComposer } from "@/context";
import { LLMLoop, type LLMLoopEvent, type LLMLoopRunOptions } from "@/loop";
import {
  LLMPromptBuilder,
  type LLMPromptToolOptions,
  type LLMPromptContextOptions
} from "@/prompt";
import {
  LLMConversationRepository,
  type LLMConversationSnapshot,
  type LLMConversationCreateOptions
} from "@/conversations";
import type { AIInject, AIProviderConfigSnapshot } from "@/inject";
import type { LLMProviderConfig, LLMProviderConfigPublic } from "@/provider/interface";

import type {
  AIAgentEvent,
  AIAgentOptions,
  AIAgentListener,
  AIAgentRunState,
  AIAgentRunContext,
  AIAgentChatOptions,
  AIAgentRunningRunSnapshot,
  AIAgentCreateConfigOptions,
  AIAgentCreateConversationResult
} from "./interface";

export class AIAgent {
  private readonly inject: AIInject;
  private readonly maxSteps: number;
  private readonly tools?: LLMPromptToolOptions;
  private readonly context?: LLMPromptContextOptions;
  private readonly promptBuilder: LLMPromptBuilder;
  private readonly titlePrompt: string;
  private readonly titleMaxOutputTokens: number;
  private readonly conversationRepository: LLMConversationRepository;
  private readonly eventsHistory = new Map<string, AIAgentEvent[]>();
  private readonly runs = new Map<string, AIAgentRunState>();
  private readonly providers = new Map<string, LLMProvider>();
  private readonly busyConversations = new Map<string, string>();

  constructor(options: AIAgentOptions) {
    this.inject = options.inject;
    this.maxSteps = options.maxSteps;
    this.titlePrompt = options.titlePrompt;
    this.titleMaxOutputTokens = options.titleMaxOutputTokens;
    this.promptBuilder = new LLMPromptBuilder(options.systemPrompt);
    this.conversationRepository = new LLMConversationRepository(options.inject);

    if (options.tools) {
      const registry = new LLMToolRegistry(options.tools);
      const result = registry.register(options.tools.list);
      if (result.isErr()) throw result.reason;

      this.tools = {
        registry: registry,
        strict: options.tools.strict,
        choice: options.tools.choice
      };
    }

    if (options.context) {
      this.context = {
        maxChars: options.context.maxChars,
        composer: new LLMContextComposer({
          inject: options.inject,
          sources: options.context.sources
        }),
        defaultRole: options.context.defaultRole
      };
    }

    for (const provider of options.providers) {
      this.providers.set(provider.name, provider);
    }
  }

  //# region events
  private readonly listeners = new Set<AIAgentListener>();
  listen(listener: AIAgentListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private readonly eventListeners = new Map<AIAgentEvent["type"], Set<AIAgentListener>>();
  listenEvent<TType extends AIAgentEvent["type"]>(
    type: TType,
    listener: AIAgentListener<Extract<AIAgentEvent, { type: TType }>>
  ) {
    const listeners = this.eventListeners.get(type) ?? new Set<AIAgentListener>();
    listeners.add(listener as AIAgentListener);
    this.eventListeners.set(type, listeners);
    return () => listeners.delete(listener as AIAgentListener);
  }

  private emitError(run: AIAgentRunContext, error: AIError) {
    this.emit({
      error,
      type: "error",
      runID: run.runID,
      conversationID: run.conversationID
    });
  }

  private emit(event: AIAgentEvent) {
    const history = this.eventsHistory.get(event.runID) ?? [];
    history.push(event);
    this.eventsHistory.set(event.runID, history);

    for (const listener of [...this.listeners, ...(this.eventListeners.get(event.type) ?? [])]) {
      try {
        listener(structuredClone(event));
      } catch (error) {
        this.inject.Log.error("Agent", "listener execute error:", error);
      }
    }
  }

  private runningHistory(runID: string) {
    return this.eventsHistory.get(runID) ?? [];
  }

  //# endregion

  //# region config
  private getProvider(name: string): AIResult<LLMProvider> {
    const provider = this.providers.get(name);
    if (!provider) {
      return AIResult.err({
        type: "no_config",
        message: `provider 未注册：${name}`
      });
    }

    return AIResult.ok(provider);
  }

  private resolveConfig<TConfig extends LLMProviderConfig = LLMProviderConfig>(
    input: AIAgentCreateConfigOptions<TConfig>
  ): AIResult<{ provider: LLMProvider<TConfig>; input: AIAgentCreateConfigOptions<TConfig> }> {
    input = structuredClone(input);
    input.name = input.name.trim();
    input.config.apiKey = input.config.apiKey.trim();
    input.config.model = input.config.model.trim();
    input.config.baseURL = input.config.baseURL?.trim() || undefined;

    if (!input.name || !input.provider || !input.config.apiKey) {
      return AIResult.err({
        type: "invalid_config",
        message: "创建 provider config 需要 name、provider 和 apiKey"
      });
    }

    const providerResult = this.getProvider(input.provider);
    if (providerResult.isErr()) return providerResult;
    const provider = providerResult.unwrap();

    return AIResult.ok({ provider, input });
  }

  private toPublicConfig(config: LLMProviderConfig): LLMProviderConfigPublic {
    const encode = (key: string): `${string}****${string}` => {
      if (key.length >= 20) {
        return `${key.substring(0, 3)}****${key.substring(key.length - 3)}`;
      } else if (key.length >= 10) {
        return `${key.substring(0, 3)}****`;
      } else {
        return "****";
      }
    };
    return {
      ...config,
      apiKey: encode(config.apiKey)
    };
  }

  public async createConfig<TConfig extends LLMProviderConfig = LLMProviderConfig>(
    _input: AIAgentCreateConfigOptions<TConfig>
  ): Promise<AIResult<AIProviderConfigSnapshot>> {
    const validatedInput = this.resolveConfig<TConfig>(_input);
    if (validatedInput.isErr()) return validatedInput;
    const { input, provider } = validatedInput.unwrap();

    const checkResult = await provider.check(input.config);
    if (checkResult.isErr()) return checkResult;

    const id = input.id?.trim() ?? this.inject.CreateID();
    const keySaved = await this.inject.ProviderAPIKeyStore.write(id, input.config.apiKey);
    if (keySaved.isErr()) return keySaved;

    const now = Date.now();
    const snapshot: AIProviderConfigSnapshot = {
      id,
      createdAt: now,
      updatedAt: now,
      name: input.name,
      provider: input.provider,
      check: checkResult.unwrap(),
      config: this.toPublicConfig(input.config)
    };
    const configSaved = await this.inject.ProviderConfigStore.write(snapshot);
    if (configSaved.isErr()) {
      await this.inject.ProviderAPIKeyStore.remove(id);
      return configSaved;
    }

    return AIResult.ok(snapshot);
  }

  public listProviders() {
    return [...this.providers.keys()];
  }

  public listConfigs() {
    return this.inject.ProviderConfigStore.list();
  }
  //# endregion

  //#region conversation
  public createConversation(
    options: Partial<LLMConversationCreateOptions> = {}
  ): Promise<AIResult<AIAgentCreateConversationResult>> {
    return this.conversationRepository
      .create(options)
      .then((conversation) => conversation.map((c) => ({ id: c.id })));
  }

  public getConversationSnapshot(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>> {
    return this.conversationRepository
      .load(id)
      .then((conversation) => conversation.map((c) => c?.snapshot()));
  }

  public removeConversation(id: string): Promise<AIResult<void>> {
    if (this.busyConversations.has(id)) {
      return Promise.resolve(
        AIResult.err({
          type: "conversation_busy",
          message: `conversation 正在运行：${id}`
        })
      );
    }

    return this.conversationRepository.remove(id);
  }

  public listConversations() {
    return this.inject.ConversationStore.list();
  }
  //#endregion

  //#region run
  public listRuns(): AIAgentRunningRunSnapshot[] {
    return [...this.runs.values()].map(({ runID, configID, conversationID }) => ({
      runID,
      configID,
      conversationID
    }));
  }

  private async loadRuntimeConfig(
    configID: string
  ): Promise<AIResult<{ provider: LLMProvider; config: LLMProviderConfig }>> {
    const snapshotResult = await this.inject.ProviderConfigStore.read(configID);
    if (snapshotResult.isErr()) return snapshotResult;

    const configSnapshot = snapshotResult.unwrap();
    if (!configSnapshot) {
      return AIResult.err({
        type: "no_config",
        message: `provider config 不存在：${configID}`
      });
    }

    const apiKeyResult = await this.inject.ProviderAPIKeyStore.read(configID);
    if (apiKeyResult.isErr()) return apiKeyResult;

    const configAPIKey = apiKeyResult.unwrap();
    if (!configAPIKey) {
      return AIResult.err({
        type: "no_config",
        message: `provider config 缺少 apiKey：${configID}`
      });
    }

    const providerResult = this.getProvider(configSnapshot.provider);
    if (providerResult.isErr()) return providerResult;

    return AIResult.ok({
      provider: providerResult.unwrap(),
      config: {
        ...configSnapshot.config,
        apiKey: configAPIKey
      } satisfies LLMProviderConfig
    });
  }

  private async generateTitleIfNeeded(run: AIAgentRunContext): Promise<AIResult<void>> {
    if (run.conversation.name.trim() || run.conversation.toMessages().length) {
      return AIResult.ok(undefined);
    }

    const response = await run.provider.generate(run.config, {
      signal: run.controller.signal,
      maxOutputTokens: this.titleMaxOutputTokens,
      messages: [
        { role: "system", content: this.titlePrompt },
        { role: "user", content: run.input }
      ]
    });
    if (response.isErr()) return response;

    const title = response
      .unwrap()
      .text.trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/\s+/g, " ");
    if (!title) {
      return AIResult.err({
        type: "bad_response",
        message: "标题生成结果为空"
      });
    }

    const renamed = run.conversation.rename(title);
    if (renamed.isErr()) return renamed;

    this.emit({
      title,
      type: "title",
      runID: run.runID,
      conversationID: run.conversationID
    });
    return AIResult.ok(undefined);
  }

  private async handleLoopEvent(
    run: AIAgentRunContext,
    event: LLMLoopEvent
  ): Promise<AIResult<void>> {
    switch (event.type) {
      case "text_delta": {
        this.emit({
          type: "text_delta",
          step: event.step,
          text: event.text,
          runID: run.runID,
          conversationID: run.conversationID
        });
        break;
      }
      case "tool_call": {
        this.emit({
          type: "tool_call",
          step: event.step,
          text: event.text,
          runID: run.runID,
          conversationID: run.conversationID,
          toolCalls: event.toolCalls
        });
        break;
      }
      case "tool_result": {
        this.emit({
          type: "tool_result",
          step: event.step,
          runID: run.runID,
          conversationID: run.conversationID,
          toolResults: event.toolResults.map((result) => ({
            name: result.name,
            callID: result.callID,
            output: result.output
          }))
        });
        break;
      }
      case "done": {
        for (const message of event.messages) {
          const appended = run.conversation.appendMessage(message);
          if (appended.isErr()) return appended;
        }

        const saved = await this.conversationRepository.save(run.conversation);
        if (saved.isErr()) return saved;

        this.emit({
          type: "done",
          runID: run.runID,
          conversationID: run.conversationID,
          snapshot: run.conversation.snapshot(),
          response: {
            text: event.response.text,
            usage: event.response.usage,
            toolCalls: structuredClone(event.response.toolCalls),
            finishReason: event.response.finishReason
          }
        });
        break;
      }
    }

    return AIResult.ok(undefined);
  }

  private async runChat(run: AIAgentRunContext) {
    try {
      this.emit({
        type: "started",
        at: Date.now(),
        runID: run.runID,
        configID: run.configID,
        conversationID: run.conversationID
      });

      const titleResult = await this.generateTitleIfNeeded(run);
      if (titleResult.isErr()) {
        this.emitError(run, titleResult.reason);
        return;
      }

      const loopOptions: LLMLoopRunOptions = {
        input: run.input,
        conversation: run.conversation,
        signal: run.controller.signal,
        temperature: run.temperature,
        maxOutputTokens: run.maxOutputTokens,
        maxSteps: this.maxSteps,
        provider: run.provider,
        config: run.config,
        promptBuilder: this.promptBuilder,
        ...(this.tools ? { tools: this.tools } : {}),
        ...(this.context
          ? { context: { ...this.context, conversationID: run.conversationID } }
          : {})
      };
      for await (const eventResult of LLMLoop.run(loopOptions)) {
        if (eventResult.isErr()) {
          if (eventResult.reason.type === "aborted") {
            this.emit({
              type: "aborted",
              runID: run.runID,
              conversationID: run.conversationID
            });
          } else {
            this.emitError(run, eventResult.reason);
          }
          return;
        }

        const event = eventResult.unwrap();
        const handled = await this.handleLoopEvent(run, event);
        if (handled.isErr()) {
          this.emitError(run, handled.reason);
          return;
        }

        if (event.type === "done") return;
      }
    } catch (error) {
      this.emitError(run, AIError.raw(error));
    } finally {
      this.runs.delete(run.runID);
      this.eventsHistory.delete(run.runID);
      this.busyConversations.delete(run.conversationID);
    }
  }

  public async chat(options: AIAgentChatOptions): Promise<AIResult<AIAgentRunningRunSnapshot>> {
    if (this.busyConversations.has(options.conversationID)) {
      return AIResult.err({
        type: "conversation_busy",
        message: `conversation 正在运行：${options.conversationID}`
      });
    }

    const runtimeConfig = await this.loadRuntimeConfig(options.configID);
    if (runtimeConfig.isErr()) return runtimeConfig;
    const { config, provider } = runtimeConfig.unwrap();

    const conversationResult = await this.conversationRepository.load(options.conversationID);
    if (conversationResult.isErr()) return conversationResult;

    const conversation = conversationResult.unwrap();
    if (!conversation) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `conversation 不存在：${options.conversationID}`
      });
    }

    const runID = this.inject.CreateID();
    const run: AIAgentRunState = {
      runID,
      configID: options.configID,
      conversationID: options.conversationID,
      controller: new AbortController()
    };
    this.runs.set(runID, run);
    this.busyConversations.set(options.conversationID, runID);

    queueMicrotask(() => {
      void this.runChat({
        ...run,
        config,
        provider,
        conversation,
        input: options.input,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens
      });
    });

    return AIResult.ok({
      runID,
      configID: options.configID,
      conversationID: options.conversationID
    });
  }

  public abort(runID: string): AIResult<void> {
    const run = this.runs.get(runID);
    if (!run) {
      return AIResult.err({
        type: "run_not_found",
        message: `run 不存在：${runID}`
      });
    }

    run.controller.abort();
    return AIResult.ok(undefined);
  }
  //#endregion
}
