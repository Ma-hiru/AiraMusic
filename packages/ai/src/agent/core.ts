import { LLMToolRegistry } from "@/tools";
import { AIError, AIResult } from "@/result";
import { LLMContextComposer } from "@/context";
import { AIAgentSkillRegistry } from "@/skills";
import { LLMLoop, type LLMLoopEvent, type LLMLoopRunOptions } from "@/loop";
import { LLMProvider, type LLMUsage, type LLMMessage, type LLMFinishReason } from "@/provider";
import {
  LLMPromptBuilder,
  type LLMPromptToolOptions,
  type LLMPromptContextOptions
} from "@/prompt";
import {
  LLMConversation,
  LLMConversationRepository,
  type LLMConversationUsage,
  type LLMConversationSnapshot,
  type LLMConversationCreateOptions,
  type LLMConversationRuntimeStatus
} from "@/conversations";
import type { AIInject, AIProviderConfigSnapshot } from "@/inject";
import type {
  LLMProviderConfig,
  LLMProviderDescriptor,
  LLMProviderConfigPublic
} from "@/provider/interface";

import type {
  AIAgentEvent,
  AIAgentOptions,
  AIAgentListener,
  AIAgentRunState,
  AIAgentRunContext,
  AIAgentChatOptions,
  AIAgentRunningRunSnapshot,
  AIAgentCreateConfigOptions,
  AIAgentEventReplaySnapshot,
  AIAgentUpdateConfigOptions,
  AIAgentCreateConversationResult
} from "./interface";

const MAX_REPLAY_EVENTS_PER_RUN = 256;
const MAX_TERMINAL_REPLAY_RUNS = 16;
const MAX_CONVERSATION_TITLE_CHARS = 20;
const MAX_CHAT_INPUT_CHARS = 64_000;
const MAX_CHAT_OUTPUT_TOKENS = 131_072;
const MAX_CHAT_IDENTIFIER_CHARS = 256;

const normalizeConversationTitle = (value: string) => {
  const normalized = value
    .trim()
    .replace(/^(["'“”‘’]+)|(["'“”‘’]+)$/g, "")
    .replace(/^(?:会话)?标题\s*[:：]\s*/i, "")
    .replace(/^(?:[#>*-]+\s*|\d+[.、]\s*)/, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(normalized);
  if (chars.length <= MAX_CONVERSATION_TITLE_CHARS) return normalized;
  return `${chars.slice(0, MAX_CONVERSATION_TITLE_CHARS - 1).join("")}…`;
};

export class AIAgent {
  private readonly inject: AIInject;
  private readonly maxSteps: number;
  private readonly transformFinalText?: AIAgentOptions["transformFinalText"];
  private readonly tools?: LLMPromptToolOptions;
  private readonly selectTools?: NonNullable<AIAgentOptions["tools"]>["select"];
  private readonly context?: LLMPromptContextOptions;
  private readonly skills?: AIAgentSkillRegistry;
  private readonly promptBuilder: LLMPromptBuilder;
  private readonly titlePrompt: string;
  private readonly titleMaxOutputTokens: number;
  private readonly conversationRepository: LLMConversationRepository;
  private nextEventSequence = 0;
  private readonly eventsHistory = new Map<string, AIAgentEventReplaySnapshot>();
  private readonly runs = new Map<string, AIAgentRunState>();
  private readonly providers = new Map<string, LLMProvider>();
  private readonly busyConversations = new Map<string, string>();
  private readonly creatingConfigIDs = new Set<string>();

  constructor(options: AIAgentOptions) {
    this.inject = options.inject;
    this.maxSteps = options.maxSteps;
    this.transformFinalText = options.transformFinalText;
    this.titlePrompt = options.titlePrompt;
    this.titleMaxOutputTokens = options.titleMaxOutputTokens;
    this.skills = options.skills ? new AIAgentSkillRegistry(options.skills.list) : undefined;
    const stableInstructions = this.skills?.stableInstructions() ?? [];
    this.promptBuilder = new LLMPromptBuilder(
      stableInstructions.length
        ? [options.systemPrompt, ...stableInstructions]
        : options.systemPrompt,
      options.history === false ? undefined : (options.history ?? {})
    );
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
      this.selectTools = options.tools.select;
    }

    if (options.context) {
      this.context = {
        maxChars: options.context.maxChars,
        composer: new LLMContextComposer({
          inject: options.inject,
          sources: options.context.sources
        }),
        defaultRole: options.context.defaultRole,
        placement: options.context.placement
      };
    }

    for (const provider of options.providers) {
      this.providers.set(provider.name, provider);
    }
  }

  //#region 事件
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
      error: { type: error.type, message: error.message },
      type: "error",
      runID: run.runID,
      conversationID: run.conversationID,
      snapshot: run.persistedConversation.snapshot()
    });
  }

  private emit(event: AIAgentEvent) {
    const sequence = ++this.nextEventSequence;
    const history = this.eventsHistory.get(event.runID) ?? {
      runID: event.runID,
      terminal: false,
      truncated: false,
      conversationID: event.conversationID,
      eventReplay: []
    };
    const lastReplay = history.eventReplay.at(-1);
    if (
      event.type === "text_delta" &&
      lastReplay?.event.type === "text_delta" &&
      lastReplay.event.step === event.step
    ) {
      lastReplay.sequence = sequence;
      lastReplay.event.text += event.text;
    } else {
      history.eventReplay.push({ sequence, event: structuredClone(event) });
    }
    history.terminal = event.type === "done" || event.type === "error" || event.type === "aborted";

    if (history.eventReplay.length > MAX_REPLAY_EVENTS_PER_RUN) {
      const excess = history.eventReplay.length - MAX_REPLAY_EVENTS_PER_RUN;
      const preserveStarted = history.eventReplay[0]?.event.type === "started";
      history.eventReplay.splice(preserveStarted ? 1 : 0, excess);
      history.truncated = true;
    }
    this.eventsHistory.set(event.runID, history);
    if (history.terminal) this.pruneTerminalReplay();

    for (const listener of [...this.listeners, ...(this.eventListeners.get(event.type) ?? [])]) {
      try {
        listener(structuredClone(event), sequence);
      } catch (error) {
        this.inject.Log.error("Agent", "listener execute error:", error);
      }
    }
  }

  private pruneTerminalReplay() {
    const terminalRunIDs = Array.from(this.eventsHistory.values())
      .filter((history) => history.terminal)
      .map((history) => history.runID);
    for (const runID of terminalRunIDs.slice(0, -MAX_TERMINAL_REPLAY_RUNS)) {
      this.eventsHistory.delete(runID);
    }
  }

  public listEventReplay(): AIAgentEventReplaySnapshot[] {
    return Array.from(this.eventsHistory.values(), (history) => structuredClone(history));
  }

  public getEventReplay(runID: string, afterSequence = 0): Optional<AIAgentEventReplaySnapshot> {
    const history = this.eventsHistory.get(runID);
    if (!history) return undefined;

    const snapshot = structuredClone(history);
    snapshot.eventReplay = snapshot.eventReplay.filter((item) => item.sequence > afterSequence);
    return snapshot;
  }

  //#endregion

  //#region 配置
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

  private resolveConfig(input: AIAgentCreateConfigOptions<unknown>): AIResult<{
    provider: LLMProvider;
    input: AIAgentCreateConfigOptions<LLMProviderConfig>;
  }> {
    input = structuredClone(input);
    input.name = input.name.trim();
    input.provider = input.provider.trim();

    if (!input.name || !input.provider) {
      return AIResult.err({
        type: "invalid_config",
        message: "创建 provider config 需要 name 和 provider"
      });
    }

    const providerResult = this.getProvider(input.provider);
    if (providerResult.isErr()) return providerResult;
    const provider = providerResult.unwrap();
    const configResult = provider.parseConfig(input.config);
    if (configResult.isErr()) return configResult;

    return AIResult.ok({
      provider,
      input: {
        ...input,
        config: configResult.unwrap()
      }
    });
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

  public async createConfig(
    _input: AIAgentCreateConfigOptions<unknown>
  ): Promise<AIResult<AIProviderConfigSnapshot>> {
    const validatedInput = this.resolveConfig(_input);
    if (validatedInput.isErr()) return validatedInput;
    const { input, provider } = validatedInput.unwrap();

    const id = input.id === undefined ? this.inject.CreateID() : input.id.trim();
    if (!id) {
      return AIResult.err({
        type: "invalid_config",
        message: "provider config id 不能为空"
      });
    }
    if (this.creatingConfigIDs.has(id)) {
      return AIResult.err({
        type: "invalid_config",
        message: `provider config id 已存在或正在创建：${id}`
      });
    }

    this.creatingConfigIDs.add(id);
    try {
      const existingResult = await this.inject.ProviderConfigStore.read(id);
      if (existingResult.isErr()) return existingResult;
      if (existingResult.unwrap()) {
        return AIResult.err({
          type: "invalid_config",
          message: `provider config id 已存在：${id}`
        });
      }

      const checkResult = await provider.check(input.config);
      if (checkResult.isErr()) return checkResult;

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
    } finally {
      this.creatingConfigIDs.delete(id);
    }
  }

  public async updateConfig(
    _input: AIAgentUpdateConfigOptions<unknown>
  ): Promise<AIResult<AIProviderConfigSnapshot>> {
    const input = structuredClone(_input);
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.id !== "string" ||
      typeof input.name !== "string" ||
      typeof input.provider !== "string"
    ) {
      return AIResult.err({
        type: "invalid_config",
        message: "更新 provider config 需要 id、name 和 provider"
      });
    }

    const id = input.id.trim();
    const name = input.name.trim();
    const providerName = input.provider.trim();
    if (!id || !name || !providerName) {
      return AIResult.err({
        type: "invalid_config",
        message: "更新 provider config 需要 id、name 和 provider"
      });
    }
    if (!input.config || typeof input.config !== "object" || Array.isArray(input.config)) {
      return AIResult.err({
        type: "invalid_config",
        message: "更新 provider config 需要有效的 config"
      });
    }

    const storedResult = await this.inject.ProviderConfigStore.read(id);
    if (storedResult.isErr()) return storedResult;
    const stored = storedResult.unwrap();
    if (!stored) {
      return AIResult.err({
        type: "no_config",
        message: `provider config 不存在：${id}`
      });
    }

    const oldAPIKeyResult = await this.inject.ProviderAPIKeyStore.read(id);
    if (oldAPIKeyResult.isErr()) return oldAPIKeyResult;
    const oldAPIKey = oldAPIKeyResult.unwrap();

    const configInput = structuredClone(input.config) as Record<string, unknown>;
    const apiKeyInput = configInput["apiKey"];
    if (apiKeyInput !== undefined && typeof apiKeyInput !== "string") {
      return AIResult.err({
        type: "invalid_config",
        message: "API Key 必须是字符串"
      });
    }

    const submittedAPIKey = apiKeyInput?.trim();
    const replacesAPIKey = Boolean(submittedAPIKey && submittedAPIKey !== stored.config.apiKey);
    const effectiveAPIKey = replacesAPIKey ? submittedAPIKey : oldAPIKey;
    if (!effectiveAPIKey) {
      return AIResult.err({
        type: "no_config",
        message: `provider config 缺少 apiKey：${id}`
      });
    }
    delete configInput["apiKey"];

    const providerResult = this.getProvider(providerName);
    if (providerResult.isErr()) return providerResult;
    const provider = providerResult.unwrap();
    const configResult = provider.parseConfig({
      ...configInput,
      apiKey: effectiveAPIKey
    });
    if (configResult.isErr()) return configResult;
    const config = configResult.unwrap();

    const normalizeBaseURL = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined;
    const changesProvider = providerName !== stored.provider;
    const changesBaseURL =
      normalizeBaseURL(config.baseURL) !== normalizeBaseURL(stored.config.baseURL);
    if (!replacesAPIKey && (changesProvider || changesBaseURL)) {
      return AIResult.err({
        type: "invalid_config",
        message: "修改 Provider 或 Base URL 时必须重新输入 API Key"
      });
    }

    const checkResult = await provider.check(config);
    if (checkResult.isErr()) return checkResult;

    const snapshot: AIProviderConfigSnapshot = {
      ...stored,
      id,
      name,
      provider: providerName,
      check: checkResult.unwrap(),
      config: this.toPublicConfig(config),
      updatedAt: Math.max(Date.now(), stored.updatedAt + 1)
    };

    if (replacesAPIKey) {
      const keySaved = await this.inject.ProviderAPIKeyStore.write(id, effectiveAPIKey);
      if (keySaved.isErr()) return keySaved;
    }

    const configSaved = await this.inject.ProviderConfigStore.write(snapshot);
    if (configSaved.isErr()) {
      if (!replacesAPIKey) return configSaved;

      const rollback = oldAPIKey
        ? await this.inject.ProviderAPIKeyStore.write(id, oldAPIKey)
        : await this.inject.ProviderAPIKeyStore.remove(id);
      if (rollback.isErr()) {
        return AIResult.err({
          type: "config_storage",
          message: `更新 provider config 失败，API Key 回滚也失败：${configSaved.reason.message}；${rollback.reason.message}`,
          raw: { save: configSaved.reason, rollback: rollback.reason }
        });
      }
      return configSaved;
    }

    return AIResult.ok(snapshot);
  }

  public listProviders() {
    return [...this.providers.keys()];
  }

  public listProviderDescriptors(): LLMProviderDescriptor[] {
    return Array.from(this.providers.values(), (provider) => structuredClone(provider.descriptor));
  }

  public listConfigs() {
    return this.inject.ProviderConfigStore.list();
  }
  //#endregion

  //#region 会话
  public createConversation(
    options: Partial<LLMConversationCreateOptions> = {}
  ): Promise<AIResult<AIAgentCreateConversationResult>> {
    return this.conversationRepository
      .create(options)
      .then((conversation) => conversation.map((c) => ({ id: c.id })));
  }

  public async getConversationSnapshot(
    id: string
  ): Promise<AIResult<Optional<LLMConversationSnapshot>>> {
    const loaded = await this.conversationRepository.load(id);
    if (loaded.isErr()) return loaded;

    const conversation = loaded.unwrap();
    if (!conversation) return AIResult.ok(undefined);
    const runtime = conversation.getRuntime();
    if (runtime?.status === "running" && !this.busyConversations.has(id)) {
      const recovered = conversation.setRuntime({
        ...runtime,
        status: "aborted",
        endedAt: Date.now(),
        terminal: true,
        incomplete: true,
        error: {
          type: "aborted",
          message: "上一次 Agent 运行在应用退出前未完成"
        }
      });
      if (recovered.isErr()) return recovered;
      const saved = await this.conversationRepository.save(conversation);
      if (saved.isErr()) return saved;
    }
    return AIResult.ok(conversation.snapshot());
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

  public async listConversations(): Promise<
    AIResult<Array<Pick<LLMConversationSnapshot, "id" | "name">>>
  > {
    const listed = await this.inject.ConversationStore.list();
    if (listed.isErr()) return listed;

    const conversations = listed.unwrap();
    for (const summary of conversations) {
      if (summary.name.trim()) continue;

      const loaded = await this.conversationRepository.load(summary.id);
      if (loaded.isErr()) {
        this.inject.Log.warn("Agent", "读取无标题会话失败，跳过标题修复:", loaded.reason);
        continue;
      }

      const conversation = loaded.unwrap();
      if (!conversation) continue;
      const firstUserMessage = conversation
        .toMessages()
        .find((message) => message.role === "user")?.content;
      const title = normalizeConversationTitle(firstUserMessage ?? "");
      if (!title) continue;

      const renamed = conversation.rename(title);
      if (renamed.isErr()) continue;
      const saved = await this.conversationRepository.save(conversation);
      if (saved.isErr()) {
        this.inject.Log.warn("Agent", "保存修复后的会话标题失败:", saved.reason);
        continue;
      }
      summary.name = title;
    }

    return AIResult.ok(conversations);
  }
  //#endregion

  //#region 运行
  public listRuns(): AIAgentRunningRunSnapshot[] {
    return [...this.runs.values()].map(({ runID, configID, conversationID }) => {
      const replay = this.getEventReplay(runID);
      return {
        runID,
        configID,
        conversationID,
        eventReplay: replay?.eventReplay ?? [],
        eventReplayTruncated: replay?.truncated ?? false
      };
    });
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

    const provider = providerResult.unwrap();
    const configResult = provider.parseConfig({
      ...configSnapshot.config,
      apiKey: configAPIKey
    });
    if (configResult.isErr()) return configResult;

    return AIResult.ok({ provider, config: configResult.unwrap() });
  }

  private syncCompaction(run: AIAgentRunContext) {
    const source = run.conversation.getCompaction();
    const persisted = run.persistedConversation.getCompaction();
    if (JSON.stringify(source) !== JSON.stringify(persisted)) {
      run.persistedConversation.setCompaction(source);
    }
  }

  private async persistConversation(run: AIAgentRunContext): Promise<AIResult<void>> {
    this.syncCompaction(run);
    return this.conversationRepository.save(run.persistedConversation);
  }

  private async prepareRun(run: AIAgentRunContext): Promise<AIResult<void>> {
    const appended = run.persistedConversation.appendMessage({
      role: "user",
      content: run.input
    });
    if (appended.isErr()) return appended;
    run.persistedTurnMessageCount = 1;

    const runtime = run.persistedConversation.setRuntime({
      runID: run.runID,
      status: "running",
      startedAt: run.startedAt,
      terminal: false,
      incomplete: true
    });
    if (runtime.isErr()) return runtime;

    return this.persistConversation(run);
  }

  private toConversationUsage(usage?: LLMUsage): Undefinable<LLMConversationUsage> {
    if (!usage) return undefined;

    const normalized: LLMConversationUsage = {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total:
        usage.totalTokens ??
        (usage.inputTokens !== undefined || usage.outputTokens !== undefined
          ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
          : undefined),
      cachedInput: usage.cachedInputTokens,
      cacheWrite: usage.cacheWriteTokens,
      reasoning: usage.reasoningTokens
    };
    const entries = Object.entries(normalized).filter(([, value]) => value !== undefined);
    return entries.length ? (Object.fromEntries(entries) as LLMConversationUsage) : undefined;
  }

  private accumulateUsage(run: AIAgentRunContext, usage?: LLMUsage) {
    const next = this.toConversationUsage(usage);
    if (!next) return;

    const current = this.toConversationUsage(run.accumulatedUsage);
    const sum = (left?: number, right?: number) =>
      left === undefined && right === undefined ? undefined : (left ?? 0) + (right ?? 0);
    const accumulated: LLMUsage = {
      inputTokens: sum(current?.input, next.input),
      outputTokens: sum(current?.output, next.output),
      totalTokens: sum(current?.total, next.total),
      cachedInputTokens: sum(current?.cachedInput, next.cachedInput),
      cacheWriteTokens: sum(current?.cacheWrite, next.cacheWrite),
      reasoningTokens: sum(current?.reasoning, next.reasoning)
    };
    run.accumulatedUsage = accumulated;
  }

  private appendPersistedMessages(
    run: AIAgentRunContext,
    messages: readonly LLMMessage[],
    finalTurn?: {
      step: number;
      usage?: LLMUsage;
      finishReason: LLMFinishReason;
      status: "complete" | "incomplete";
    }
  ): AIResult<void> {
    if (messages.length < run.persistedTurnMessageCount) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "loop 返回的 turn messages 发生回退"
      });
    }

    const pending = run.pendingToolCall;
    for (const message of messages.slice(run.persistedTurnMessageCount)) {
      const messageIndex = run.persistedConversation.messageCount();
      const appended = run.persistedConversation.appendMessage(message);
      if (appended.isErr()) return appended;
      run.persistedTurnMessageCount += 1;

      if (message.role !== "assistant") continue;
      const isToolCall = "toolCalls" in message;
      const metadata = isToolCall
        ? pending && {
            step: pending.step,
            status: "complete" as const,
            usage: pending.usage,
            finishReason: pending.finishReason
          }
        : finalTurn;
      if (!metadata) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `缺少 assistant turn 元数据：${messageIndex}`
        });
      }

      const normalizedUsage = this.toConversationUsage(metadata.usage);
      const recorded = run.persistedConversation.recordAssistantTurn({
        runID: run.runID,
        step: metadata.step,
        status: metadata.status,
        messageIndex,
        finishReason: metadata.finishReason,
        ...(normalizedUsage ? { usage: normalizedUsage } : {})
      });
      if (recorded.isErr()) return recorded;
    }

    return AIResult.ok(undefined);
  }

  private flushIncompleteMessages(run: AIAgentRunContext, error: AIError): AIResult<void> {
    if (
      error.raw &&
      typeof error.raw === "object" &&
      "discardPartialText" in error.raw &&
      error.raw.discardPartialText === true
    ) {
      // 最终回复未通过宿主校验时，不能把已流出的未校验草稿写入持久化会话。
      run.partialText.clear();
      run.pendingToolCall = undefined;
      return AIResult.ok(undefined);
    }

    const pending = run.pendingToolCall;
    if (pending) {
      const messageIndex = run.persistedConversation.messageCount();
      const appended = run.persistedConversation.appendMessage(pending.message);
      if (appended.isErr()) return appended;
      run.persistedTurnMessageCount += 1;

      const normalizedUsage = this.toConversationUsage(run.accumulatedUsage);
      const recorded = run.persistedConversation.recordAssistantTurn({
        runID: run.runID,
        step: pending.step,
        status: "complete",
        messageIndex,
        finishReason: pending.finishReason,
        ...(normalizedUsage ? { usage: normalizedUsage } : {})
      });
      if (recorded.isErr()) return recorded;

      for (const call of pending.message.toolCalls) {
        const toolResult = run.persistedConversation.appendMessage({
          role: "tool",
          name: call.name,
          callID: call.callID,
          content: JSON.stringify({
            call,
            error: { type: error.type, message: error.message },
            incomplete: true
          })
        });
        if (toolResult.isErr()) return toolResult;
        run.persistedTurnMessageCount += 1;
      }

      run.partialText.delete(pending.step);
      run.pendingToolCall = undefined;
    }

    for (const [step, text] of [...run.partialText.entries()].sort(([a], [b]) => a - b)) {
      if (!text) continue;
      const messageIndex = run.persistedConversation.messageCount();
      const appended = run.persistedConversation.appendMessage({
        role: "assistant",
        content: text
      });
      if (appended.isErr()) return appended;
      run.persistedTurnMessageCount += 1;

      const normalizedUsage = this.toConversationUsage(run.accumulatedUsage);
      const recorded = run.persistedConversation.recordAssistantTurn({
        runID: run.runID,
        step,
        status: "incomplete",
        messageIndex,
        ...(normalizedUsage ? { usage: normalizedUsage } : {})
      });
      if (recorded.isErr()) return recorded;
    }
    run.partialText.clear();

    const normalizedUsage = this.toConversationUsage(run.accumulatedUsage);
    const lastTurn = run.persistedConversation
      .getAssistantTurns()
      .findLast((turn) => turn.runID === run.runID);
    if (normalizedUsage && lastTurn) {
      const updated = run.persistedConversation.updateAssistantTurn(lastTurn.messageIndex, {
        usage: normalizedUsage
      });
      if (updated.isErr()) return updated;
    }
    return AIResult.ok(undefined);
  }

  private async finishWithError(run: AIAgentRunContext, initialError: AIError) {
    if (run.terminal) return;

    let error = initialError;
    const flushed = this.flushIncompleteMessages(run, error);
    if (flushed.isErr()) {
      this.inject.Log.error("Agent", "persist incomplete turn error:", flushed.reason);
      error = flushed.reason;
    }

    const status: Exclude<LLMConversationRuntimeStatus, "idle" | "running" | "completed"> =
      error.type === "aborted" ? "aborted" : error.type === "max_steps" ? "max_steps" : "failed";
    const usage = this.toConversationUsage(run.accumulatedUsage);
    const runtime = run.persistedConversation.setRuntime({
      runID: run.runID,
      status,
      startedAt: run.startedAt,
      endedAt: Date.now(),
      terminal: true,
      incomplete: true,
      ...(usage ? { usage } : {}),
      error: { type: error.type, message: error.message }
    });
    if (runtime.isErr()) error = runtime.reason;

    const saved = await this.persistConversation(run);
    if (saved.isErr()) {
      this.inject.Log.error("Agent", "persist terminal conversation error:", saved.reason);
      error = saved.reason;
      run.persistedConversation.setRuntime({
        runID: run.runID,
        status: "failed",
        startedAt: run.startedAt,
        endedAt: Date.now(),
        terminal: true,
        incomplete: true,
        ...(usage ? { usage } : {}),
        error: { type: error.type, message: error.message }
      });
      await this.persistConversation(run);
    }

    run.terminal = true;
    this.releaseRun(run);
    if (error.type === "aborted") {
      this.emit({
        type: "aborted",
        runID: run.runID,
        conversationID: run.conversationID,
        snapshot: run.persistedConversation.snapshot()
      });
    } else {
      this.emitError(run, error);
    }
  }

  private async generateTitleIfNeeded(run: AIAgentRunContext): Promise<AIResult<void>> {
    if (!run.shouldGenerateTitle) return AIResult.ok(undefined);

    const titleInput =
      run.conversation.toMessages().find((message) => message.role === "user")?.content ??
      run.input;

    const response = await run.provider.generate(run.config, {
      signal: run.controller.signal,
      maxOutputTokens: this.titleMaxOutputTokens,
      messages: [
        { role: "system", content: this.titlePrompt },
        { role: "user", content: titleInput }
      ]
    });
    let title = "";
    if (response.isErr()) {
      if (response.reason.type === "aborted") return response;
      this.inject.Log.warn("Agent", "自动生成标题失败，改用首条消息:", response.reason);
    } else {
      const generated = response.unwrap();
      this.accumulateUsage(run, generated.usage);
      title = normalizeConversationTitle(generated.text);
    }

    title ||= normalizeConversationTitle(titleInput);
    if (!title) {
      return AIResult.err({
        type: "bad_response",
        message: "无法从标题响应或首条消息生成会话标题"
      });
    }

    const renamed = run.conversation.rename(title);
    if (renamed.isErr()) return renamed;
    const persistedRenamed = run.persistedConversation.rename(title);
    if (persistedRenamed.isErr()) return persistedRenamed;

    const saved = await this.persistConversation(run);
    if (saved.isErr()) return saved;

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
        run.partialText.set(event.step, `${run.partialText.get(event.step) ?? ""}${event.text}`);
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
        this.accumulateUsage(run, event.usage);
        run.pendingToolCall = {
          step: event.step,
          usage: event.usage,
          message: structuredClone(event.message),
          finishReason: event.finishReason
        };
        this.emit({
          type: "tool_call",
          step: event.step,
          text: event.text,
          usage: event.usage,
          runID: run.runID,
          finishReason: event.finishReason,
          conversationID: run.conversationID,
          toolCalls: event.toolCalls
        });
        break;
      }
      case "tool_result": {
        const appended = this.appendPersistedMessages(run, event.messages);
        if (appended.isErr()) return appended;
        run.partialText.delete(event.step);
        run.pendingToolCall = undefined;

        const saved = await this.persistConversation(run);
        if (saved.isErr()) return saved;

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
        this.accumulateUsage(run, event.response.usage);
        const incomplete = event.response.finishReason !== "stop";
        const appended = this.appendPersistedMessages(run, event.messages, {
          step: event.step,
          usage: run.accumulatedUsage,
          finishReason: event.response.finishReason,
          status: incomplete ? "incomplete" : "complete"
        });
        if (appended.isErr()) return appended;
        run.partialText.clear();
        run.pendingToolCall = undefined;

        const usage = this.toConversationUsage(run.accumulatedUsage);
        const runtime = run.persistedConversation.setRuntime({
          runID: run.runID,
          status: "completed",
          startedAt: run.startedAt,
          endedAt: Date.now(),
          terminal: true,
          incomplete,
          ...(usage ? { usage } : {})
        });
        if (runtime.isErr()) return runtime;

        const saved = await this.persistConversation(run);
        if (saved.isErr()) return saved;
        run.terminal = true;
        this.releaseRun(run);

        this.emit({
          type: "done",
          runID: run.runID,
          conversationID: run.conversationID,
          snapshot: run.persistedConversation.snapshot(),
          response: {
            text: event.response.text,
            usage: run.accumulatedUsage,
            toolCalls: structuredClone(event.response.toolCalls),
            finishReason: event.response.finishReason
          }
        });
        break;
      }
    }

    return AIResult.ok(undefined);
  }

  private releaseRun(run: AIAgentRunState) {
    this.runs.delete(run.runID);
    if (this.busyConversations.get(run.conversationID) === run.runID) {
      this.busyConversations.delete(run.conversationID);
    }
  }

  private async runChat(run: AIAgentRunContext) {
    try {
      this.emit({
        type: "started",
        at: run.startedAt,
        runID: run.runID,
        configID: run.configID,
        conversationID: run.conversationID
      });

      const prepared = await this.prepareRun(run);
      if (prepared.isErr()) {
        await this.finishWithError(run, prepared.reason);
        return;
      }

      const titleResult = await this.generateTitleIfNeeded(run);
      if (titleResult.isErr()) {
        if (titleResult.reason.type === "aborted") {
          await this.finishWithError(run, titleResult.reason);
          return;
        }
        this.inject.Log.warn("Agent", "title generation skipped:", titleResult.reason);
      }

      const skillActivationResult = this.skills?.activate({
        input: run.input,
        conversation: run.conversation
      });
      if (skillActivationResult?.isErr()) {
        await this.finishWithError(run, skillActivationResult.reason);
        return;
      }
      const skillActivation = skillActivationResult?.unwrap();

      let selectedToolNames: string[] | undefined;
      if (this.tools && this.selectTools) {
        selectedToolNames = Array.from(
          new Set([
            ...this.selectTools({ input: run.input, conversation: run.conversation }),
            ...(skillActivation?.toolNames ?? [])
          ])
        );
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
        ...(this.transformFinalText ? { transformFinalText: this.transformFinalText } : {}),
        ...(skillActivation?.requiredEvidence.length
          ? { requiredEvidence: skillActivation.requiredEvidence }
          : {}),
        ...(skillActivation?.instructions.length
          ? { instructions: skillActivation.instructions }
          : {}),
        onUsage: (usage) => this.accumulateUsage(run, usage),
        ...(this.tools
          ? {
              tools: {
                ...this.tools,
                ...(selectedToolNames ? { selectedNames: selectedToolNames } : {})
              }
            }
          : {}),
        ...(this.context
          ? { context: { ...this.context, conversationID: run.conversationID } }
          : {})
      };
      for await (const eventResult of LLMLoop.run(loopOptions)) {
        if (eventResult.isErr()) {
          await this.finishWithError(run, eventResult.reason);
          return;
        }

        const event = eventResult.unwrap();
        const handled = await this.handleLoopEvent(run, event);
        if (handled.isErr()) {
          await this.finishWithError(run, handled.reason);
          return;
        }

        if (event.type === "done") return;
      }

      await this.finishWithError(
        run,
        new AIError({
          type: "bad_response",
          message: "loop 未返回 terminal event"
        })
      );
    } catch (error) {
      await this.finishWithError(run, AIError.raw(error));
    } finally {
      this.releaseRun(run);
    }
  }

  public async chat(options: AIAgentChatOptions): Promise<AIResult<AIAgentRunningRunSnapshot>> {
    const validatedOptions = this.validateChatOptions(options);
    if (validatedOptions.isErr()) return validatedOptions;
    options = validatedOptions.unwrap();

    if (this.busyConversations.has(options.conversationID)) {
      return AIResult.err({
        type: "conversation_busy",
        message: `conversation 正在运行：${options.conversationID}`
      });
    }

    const runID = this.inject.CreateID();
    this.busyConversations.set(options.conversationID, runID);
    let scheduled = false;

    try {
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

      const persistedConversationResult = LLMConversation.fromSnapshot(conversation.snapshot());
      if (persistedConversationResult.isErr()) return persistedConversationResult;

      const run: AIAgentRunState = {
        runID,
        configID: options.configID,
        conversationID: options.conversationID,
        controller: new AbortController()
      };
      this.runs.set(runID, run);

      queueMicrotask(() => {
        void this.runChat({
          ...run,
          config,
          provider,
          conversation,
          terminal: false,
          input: options.input,
          partialText: new Map(),
          persistedTurnMessageCount: 0,
          startedAt: Date.now(),
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          shouldGenerateTitle: !conversation.name.trim(),
          persistedConversation: persistedConversationResult.unwrap()
        });
      });
      scheduled = true;

      return AIResult.ok({
        runID,
        configID: options.configID,
        conversationID: options.conversationID,
        eventReplay: [],
        eventReplayTruncated: false
      });
    } finally {
      if (!scheduled) {
        this.runs.delete(runID);
        if (this.busyConversations.get(options.conversationID) === runID) {
          this.busyConversations.delete(options.conversationID);
        }
      }
    }
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

  private validateChatOptions(input: unknown): AIResult<AIAgentChatOptions> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "Agent 对话参数无效"
      });
    }

    const value = input as Partial<AIAgentChatOptions>;
    if (
      typeof value.input !== "string" ||
      typeof value.configID !== "string" ||
      typeof value.conversationID !== "string"
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "Agent 对话缺少 input、configID 或 conversationID"
      });
    }

    const configID = value.configID.trim();
    const conversationID = value.conversationID.trim();
    if (!value.input.trim()) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "Agent 对话输入不能为空"
      });
    }
    if (value.input.length > MAX_CHAT_INPUT_CHARS) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `Agent 对话输入不能超过 ${MAX_CHAT_INPUT_CHARS} 个字符`
      });
    }
    if (
      !configID ||
      !conversationID ||
      configID.length > MAX_CHAT_IDENTIFIER_CHARS ||
      conversationID.length > MAX_CHAT_IDENTIFIER_CHARS
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "Agent 对话的 configID 或 conversationID 无效"
      });
    }

    const maxOutputTokens = value.maxOutputTokens;
    if (
      maxOutputTokens !== undefined &&
      (!Number.isInteger(maxOutputTokens) ||
        maxOutputTokens <= 0 ||
        maxOutputTokens > MAX_CHAT_OUTPUT_TOKENS)
    ) {
      return AIResult.err({
        type: "invalid_config",
        message: `maxOutputTokens 必须是 1 到 ${MAX_CHAT_OUTPUT_TOKENS} 之间的整数`
      });
    }

    const temperature = value.temperature;
    if (
      temperature !== undefined &&
      (typeof temperature !== "number" ||
        !Number.isFinite(temperature) ||
        temperature < 0 ||
        temperature > 2)
    ) {
      return AIResult.err({
        type: "invalid_config",
        message: "temperature 必须是 0 到 2 之间的有限数值"
      });
    }

    return AIResult.ok({
      input: value.input,
      configID,
      conversationID,
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxOutputTokens === undefined ? {} : { maxOutputTokens })
    });
  }
  //#endregion
}
