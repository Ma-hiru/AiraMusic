import { AIResult } from "@/result";
import { createLog } from "@mahiru/log";
import { AIAgent, type AIAgentEvent } from "@/agent";
import {
  LLMProvider,
  type LLMCheckResponse,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider";
import type { LLMProviderConfig } from "@/provider/interface";
import type { LLMConversationSnapshot } from "@/conversations";
import type {
  AIInject,
  AIConversationStore,
  AIProviderAPIKeyStore,
  AIProviderConfigStore,
  AIProviderConfigSnapshot
} from "@/inject";

type TestConfig = LLMProviderConfig;

describe("AIAgent", () => {
  it("creates checked provider configs without exposing api keys", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);

    expect(agent.listProviders()).toEqual(["fake"]);

    const created = await agent.createConfig({
      id: "config-1",
      name: "OpenAI",
      provider: "fake",
      config: { model: "test-model", apiKey: "secret-key" }
    });

    expect(created.isOk()).toBe(true);
    expect(provider.checkedConfigs[0]).toEqual({
      model: "test-model",
      apiKey: "secret-key",
      baseURL: undefined
    });
    expect(stores.apiKeys.values.get("config-1")).toBe("secret-key");
    expect(stores.configs.values.get("config-1")?.config).toEqual({
      model: "test-model",
      apiKey: "sec****",
      baseURL: undefined
    });

    const listed = await agent.listConfigs();
    expect(listed.isOk()).toBe(true);
    expect(listed.unwrap()).toEqual([
      {
        id: "config-1",
        name: "OpenAI",
        provider: "fake",
        config: { model: "test-model", apiKey: "sec****", baseURL: undefined },
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
        check: { provider: "fake", model: "test-model" }
      }
    ]);
  });

  it("creates, lists, reads, and removes conversations", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());

    const created = await agent.createConversation({ id: "conversation-1", name: "会话" });
    expect(created.isOk()).toBe(true);
    expect(created.unwrap()).toEqual({ id: "conversation-1" });

    const listed = await agent.listConversations();
    expect(listed.isOk()).toBe(true);
    expect(listed.unwrap()).toEqual([{ id: "conversation-1", name: "会话" }]);

    const detail = await agent.getConversationSnapshot("conversation-1");
    expect(detail.isOk()).toBe(true);
    expect(detail.unwrap()?.id).toBe("conversation-1");

    expect((await agent.removeConversation("conversation-1")).isOk()).toBe(true);
    expect((await agent.getConversationSnapshot("conversation-1")).unwrap()).toBeUndefined();
  });

  it("runs chat in background, emits title and deltas, then stores the final conversation", async () => {
    const stores = createStores();
    const provider = new FakeProvider({
      title: "Aira 推荐",
      responses: [response({ text: "推荐 Aira" })]
    });
    const agent = createAgent(stores.inject, provider);
    const events: AIAgentEvent[] = [];
    const finished = waitForTerminalEvent(agent, events);

    expect(
      (
        await agent.createConfig({
          id: "config-1",
          name: "Fake",
          provider: "fake",
          config: { model: "test-model", apiKey: "secret-key" }
        })
      ).isOk()
    ).toBe(true);
    expect((await agent.createConversation({ id: "conversation-1" })).isOk()).toBe(true);

    const accepted = await agent.chat({
      configID: "config-1",
      conversationID: "conversation-1",
      input: "给我推荐 Aira"
    });
    expect(accepted.isOk()).toBe(true);

    await finished;

    expect(events.map((event) => event.type)).toEqual(["started", "title", "text_delta", "done"]);
    expect(events.find((event) => event.type === "title")).toMatchObject({
      type: "title",
      title: "Aira 推荐"
    });

    const saved = stores.conversations.values.get("conversation-1");
    expect(saved?.name).toBe("Aira 推荐");
    expect(saved?.messages).toEqual([
      { role: "user", content: "给我推荐 Aira" },
      { role: "assistant", content: "推荐 Aira" }
    ]);

    const done = events.find((event) => event.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.snapshot).toEqual(saved);
      expect(done.response.text).toBe("推荐 Aira");
    }
  });

  it("rejects concurrent runs in the same conversation", async () => {
    const stores = createStores();
    const provider = new FakeProvider({
      title: "标题",
      responses: [response({ text: "回复" })]
    });
    const agent = createAgent(stores.inject, provider);

    expect(
      (
        await agent.createConfig({
          id: "config-1",
          name: "Fake",
          provider: "fake",
          config: { model: "test-model", apiKey: "secret-key" }
        })
      ).isOk()
    ).toBe(true);
    expect((await agent.createConversation({ id: "conversation-1" })).isOk()).toBe(true);

    const first = await agent.chat({
      configID: "config-1",
      conversationID: "conversation-1",
      input: "第一句"
    });
    expect(first.isOk()).toBe(true);

    const second = await agent.chat({
      configID: "config-1",
      conversationID: "conversation-1",
      input: "第二句"
    });
    expect(second.isErr()).toBe(true);
    if (second.isErr()) expect(second.reason.type).toBe("conversation_busy");
  });
});

function createAgent(inject: AIInject, provider: FakeProvider) {
  return new AIAgent({
    inject,
    providers: [provider],
    maxSteps: 2,
    systemPrompt: "你是音乐助手",
    titleMaxOutputTokens: 16,
    titlePrompt: "把用户第一句话总结成 8 个字以内的会话标题，只输出标题"
  });
}

function waitForTerminalEvent(agent: AIAgent, events: AIAgentEvent[]) {
  return new Promise<void>((resolve, reject) => {
    const unlisten = agent.listen((event) => {
      events.push(event);
      if (event.type === "done") {
        unlisten();
        resolve();
      }
      if (event.type === "error") {
        unlisten();
        reject(new Error(event.error.message));
      }
    });
  });
}

function createStores() {
  let nextID = 0;
  const conversations = new MemoryConversationStore();
  const configs = new MemoryProviderConfigStore();
  const apiKeys = new MemoryAPIKeyStore();
  const inject = {
    ConversationStore: conversations,
    ProviderConfigStore: configs,
    ProviderAPIKeyStore: apiKeys,
    Log: createLog("TRACE"),
    CreateID: () => `id-${++nextID}`
  } satisfies AIInject;

  return { inject, conversations, configs, apiKeys };
}

class MemoryConversationStore implements AIConversationStore {
  readonly values = new Map<string, LLMConversationSnapshot>();

  async list(): Promise<AIResult<{ id: string; name: string }[]>> {
    return AIResult.ok(
      Array.from(this.values.values(), (snapshot) => ({ id: snapshot.id, name: snapshot.name }))
    );
  }

  async read(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>> {
    const snapshot = this.values.get(id);
    return AIResult.ok(snapshot ? structuredClone(snapshot) : undefined);
  }

  async write(snapshot: LLMConversationSnapshot): Promise<AIResult<void>> {
    this.values.set(snapshot.id, structuredClone(snapshot));
    return AIResult.ok(undefined);
  }

  async remove(id: string): Promise<AIResult<void>> {
    this.values.delete(id);
    return AIResult.ok(undefined);
  }
}

class MemoryProviderConfigStore implements AIProviderConfigStore {
  readonly values = new Map<string, AIProviderConfigSnapshot>();

  async list(): Promise<AIResult<AIProviderConfigSnapshot[]>> {
    return AIResult.ok(Array.from(this.values.values(), (snapshot) => structuredClone(snapshot)));
  }

  async read(id: string): Promise<AIResult<Optional<AIProviderConfigSnapshot>>> {
    const snapshot = this.values.get(id);
    return AIResult.ok(snapshot ? structuredClone(snapshot) : undefined);
  }

  async write(snapshot: AIProviderConfigSnapshot): Promise<AIResult<void>> {
    this.values.set(snapshot.id, structuredClone(snapshot));
    return AIResult.ok(undefined);
  }

  async remove(id: string): Promise<AIResult<void>> {
    this.values.delete(id);
    return AIResult.ok(undefined);
  }
}

class MemoryAPIKeyStore implements AIProviderAPIKeyStore {
  readonly values = new Map<string, string>();

  async read(configID: string): Promise<AIResult<Optional<string>>> {
    return AIResult.ok(this.values.get(configID));
  }

  async write(configID: string, apiKey: string): Promise<AIResult<void>> {
    this.values.set(configID, apiKey);
    return AIResult.ok(undefined);
  }

  async remove(configID: string): Promise<AIResult<void>> {
    this.values.delete(configID);
    return AIResult.ok(undefined);
  }
}

function response(partial: Partial<LLMGenerateResponse>): LLMGenerateResponse {
  return {
    raw: {},
    text: "",
    usage: undefined,
    toolCalls: [],
    finishReason: "stop",
    ...partial
  };
}

class FakeProvider extends LLMProvider<TestConfig> {
  readonly checkedConfigs: TestConfig[] = [];
  private readonly title: string;
  private readonly responses: LLMGenerateResponse[];

  constructor(options: { title?: string; responses?: LLMGenerateResponse[] } = {}) {
    super("fake");
    this.title = options.title ?? "标题";
    this.responses = [...(options.responses ?? [])];
  }

  async check(config: TestConfig): Promise<AIResult<LLMCheckResponse>> {
    this.checkedConfigs.push(structuredClone(config));
    return AIResult.ok({
      provider: this.name,
      model: config.model
    });
  }

  async generate<T extends TestConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: LLMGenerateRequest
  ): Promise<AIResult<LLMGenerateResponse>> {
    return AIResult.ok(response({ text: this.title }));
  }

  async *stream<T extends TestConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    const next = this.responses.shift();
    if (!next) {
      yield AIResult.err({ type: "bad_response", message: "missing fake response" });
      return;
    }

    if (next.text) {
      yield AIResult.ok({ type: "text_delta", text: next.text });
    }

    yield AIResult.ok({
      type: "done",
      text: next.text,
      raw: next.raw,
      usage: next.usage,
      toolCalls: next.toolCalls,
      finishReason: next.finishReason
    });
  }
}
