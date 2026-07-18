import { z } from "zod";
import { AIResult } from "@/result";
import { createLog } from "@mahiru/log";
import { LLMTool, type LLMToolContext } from "@/tools";
import { AIAgent, type AIAgentEvent, type AIAgentOptions } from "@/agent";
import { LLMConversation, type LLMConversationSnapshot } from "@/conversations";
import {
  LLMProvider,
  type LLMCheckResponse,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider";
import type { LLMProviderConfig } from "@/provider/interface";
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

  it("拒绝重复的 Provider 配置 ID，且不会覆盖已有密钥", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());
    const first = await agent.createConfig({
      id: "config-duplicate",
      name: "First",
      provider: "fake",
      config: { model: "first-model", apiKey: "first-secret" }
    });

    const duplicate = await agent.createConfig({
      id: "config-duplicate",
      name: "Second",
      provider: "fake",
      config: { model: "second-model", apiKey: "second-secret" }
    });

    expect(first.isOk()).toBe(true);
    expect(duplicate.isErr()).toBe(true);
    if (duplicate.isErr()) expect(duplicate.reason.type).toBe("invalid_config");
    expect(stores.apiKeys.values.get("config-duplicate")).toBe("first-secret");
    expect(stores.configs.values.get("config-duplicate")?.name).toBe("First");
  });

  it("updates provider config fields while preserving a blank or redacted api key", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    const created = await agent.createConfig({
      id: "config-update",
      name: "Original",
      provider: "fake",
      config: {
        model: "old-model",
        apiKey: "secret-key",
        baseURL: "https://old.example/v1"
      }
    });
    expect(created.isOk()).toBe(true);
    const original = created.unwrap();

    const updated = await agent.updateConfig({
      id: " config-update ",
      name: " Renamed ",
      provider: " fake ",
      config: {
        model: "new-model",
        apiKey: "",
        baseURL: "https://old.example/v1",
        timeoutMs: 24_000
      }
    });

    expect(updated.isOk()).toBe(true);
    expect(provider.checkedConfigs.at(-1)).toMatchObject({
      model: "new-model",
      apiKey: "secret-key",
      baseURL: "https://old.example/v1",
      timeoutMs: 24_000
    });
    expect(stores.apiKeys.values.get("config-update")).toBe("secret-key");
    expect(updated.unwrap()).toMatchObject({
      id: "config-update",
      name: "Renamed",
      provider: "fake",
      createdAt: original.createdAt,
      check: { provider: "fake", model: "new-model" },
      config: {
        model: "new-model",
        apiKey: "sec****",
        baseURL: "https://old.example/v1",
        timeoutMs: 24_000
      }
    });
    expect(updated.unwrap().updatedAt).toBeGreaterThan(original.updatedAt);

    const redacted = await agent.updateConfig({
      id: "config-update",
      name: "Renamed again",
      provider: "fake",
      config: {
        model: "newer-model",
        apiKey: updated.unwrap().config.apiKey,
        baseURL: "https://old.example/v1"
      }
    });
    expect(redacted.isOk()).toBe(true);
    expect(provider.checkedConfigs.at(-1)?.apiKey).toBe("secret-key");
    expect(stores.apiKeys.values.get("config-update")).toBe("secret-key");
  });

  it("没有重新输入 API Key 时拒绝把旧密钥发送到新的 Provider 或 Base URL", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    await agent.createConfig({
      id: "config-endpoint-guard",
      name: "Original",
      provider: "fake",
      config: {
        model: "old-model",
        apiKey: "secret-key",
        baseURL: "https://old.example/v1"
      }
    });
    const checksBeforeUpdate = provider.checkedConfigs.length;

    const updated = await agent.updateConfig({
      id: "config-endpoint-guard",
      name: "Blocked",
      provider: "fake",
      config: {
        model: "new-model",
        apiKey: "",
        baseURL: "https://new.example/v1"
      }
    });

    expect(updated.isErr()).toBe(true);
    if (updated.isErr()) expect(updated.reason.type).toBe("invalid_config");
    expect(provider.checkedConfigs).toHaveLength(checksBeforeUpdate);
    expect(stores.apiKeys.values.get("config-endpoint-guard")).toBe("secret-key");
  });

  it("重新输入 API Key 后允许修改 Base URL", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    await agent.createConfig({
      id: "config-endpoint-rekey",
      name: "Original",
      provider: "fake",
      config: {
        model: "old-model",
        apiKey: "secret-key",
        baseURL: "https://old.example/v1"
      }
    });

    const updated = await agent.updateConfig({
      id: "config-endpoint-rekey",
      name: "Updated",
      provider: "fake",
      config: {
        model: "new-model",
        apiKey: "new-secret-key",
        baseURL: "https://new.example/v1"
      }
    });

    expect(updated.isOk()).toBe(true);
    expect(provider.checkedConfigs.at(-1)?.baseURL).toBe("https://new.example/v1");
    expect(stores.apiKeys.values.get("config-endpoint-rekey")).toBe("new-secret-key");
  });

  it("replaces the api key only after the updated config passes provider check", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    await createReadyConfig(agent, "config-rekey");

    const updated = await agent.updateConfig({
      id: "config-rekey",
      name: "Rekeyed",
      provider: "fake",
      config: { model: "new-model", apiKey: "new-secret-key" }
    });

    expect(updated.isOk()).toBe(true);
    expect(provider.checkedConfigs.at(-1)?.apiKey).toBe("new-secret-key");
    expect(stores.apiKeys.values.get("config-rekey")).toBe("new-secret-key");
    expect(updated.unwrap().config.apiKey).toBe("new****");
  });

  it("does not persist an update when provider check fails", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    await createReadyConfig(agent, "config-check-failure");
    const original = structuredClone(stores.configs.values.get("config-check-failure"));
    vi.spyOn(provider, "check").mockResolvedValueOnce(
      AIResult.err({ type: "auth", message: "invalid replacement credentials" })
    );

    const updated = await agent.updateConfig({
      id: "config-check-failure",
      name: "Should not persist",
      provider: "fake",
      config: { model: "new-model", apiKey: "bad-key" }
    });

    expect(updated.isErr()).toBe(true);
    if (updated.isErr()) expect(updated.reason.type).toBe("auth");
    expect(stores.configs.values.get("config-check-failure")).toEqual(original);
    expect(stores.apiKeys.values.get("config-check-failure")).toBe("secret-key");
  });

  it("rolls back a replaced api key when the public config write fails", async () => {
    const stores = createStores();
    const provider = new FakeProvider();
    const agent = createAgent(stores.inject, provider);
    await createReadyConfig(agent, "config-write-failure");
    const original = structuredClone(stores.configs.values.get("config-write-failure"));
    stores.configs.failNextWrite = true;

    const updated = await agent.updateConfig({
      id: "config-write-failure",
      name: "Should roll back",
      provider: "fake",
      config: { model: "new-model", apiKey: "new-secret-key" }
    });

    expect(updated.isErr()).toBe(true);
    if (updated.isErr()) expect(updated.reason.type).toBe("config_storage");
    expect(stores.configs.values.get("config-write-failure")).toEqual(original);
    expect(stores.apiKeys.values.get("config-write-failure")).toBe("secret-key");
  });

  it("returns a clear error when updating a missing provider config", async () => {
    const agent = createAgent(createStores().inject, new FakeProvider());
    const updated = await agent.updateConfig({
      id: "missing",
      name: "Missing",
      provider: "fake",
      config: { model: "test-model", apiKey: "" }
    });

    expect(updated.isErr()).toBe(true);
    if (updated.isErr()) {
      expect(updated.reason.type).toBe("no_config");
      expect(updated.reason.message).toContain("missing");
    }
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

  it("拒绝重复的会话 ID，且不会覆盖已有消息", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());
    const first = await agent.createConversation({
      id: "conversation-duplicate",
      name: "First",
      messages: [{ role: "user", content: "保留消息" }]
    });

    const duplicate = await agent.createConversation({
      id: "conversation-duplicate",
      name: "Second",
      messages: [{ role: "user", content: "覆盖消息" }]
    });

    expect(first.isOk()).toBe(true);
    expect(duplicate.isErr()).toBe(true);
    if (duplicate.isErr()) expect(duplicate.reason.type).toBe("invalid_conversation");
    expect(stores.conversations.values.get("conversation-duplicate")?.name).toBe("First");
    expect(stores.conversations.values.get("conversation-duplicate")?.messages).toEqual([
      { role: "user", content: "保留消息" }
    ]);
  });

  it("repairs a legacy untitled conversation from its first user message when listing", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());
    const now = Date.now();
    stores.conversations.values.set("conversation-legacy-title", {
      id: "conversation-legacy-title",
      name: "",
      createdAt: now,
      updatedAt: now,
      metadata: {},
      messages: [{ role: "user", content: "介绍这首歌，并结合动画剧情" }]
    });

    const listed = await agent.listConversations();

    expect(listed.unwrap()).toEqual([
      { id: "conversation-legacy-title", name: "介绍这首歌，并结合动画剧情" }
    ]);
    expect(stores.conversations.values.get("conversation-legacy-title")?.name).toBe(
      "介绍这首歌，并结合动画剧情"
    );
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

  it("在访问配置和会话前拒绝过大的输入与输出 token 上限", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());

    const oversizedInput = await agent.chat({
      configID: "config-unused",
      conversationID: "conversation-unused",
      input: "音".repeat(64_001)
    });
    const oversizedOutput = await agent.chat({
      configID: "config-unused",
      conversationID: "conversation-unused",
      input: "正常输入",
      maxOutputTokens: 131_073
    });

    expect(oversizedInput.isErr()).toBe(true);
    expect(oversizedOutput.isErr()).toBe(true);
    if (oversizedInput.isErr()) expect(oversizedInput.reason.type).toBe("invalid_conversation");
    if (oversizedOutput.isErr()) expect(oversizedOutput.reason.type).toBe("invalid_config");
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

  it("reserves a conversation before awaiting runtime config reads", async () => {
    const stores = createStores();
    const provider = new FakeProvider({ responses: [response({ text: "回复" })] });
    const agent = createAgent(stores.inject, provider);

    expect(
      (
        await agent.createConfig({
          id: "config-race",
          name: "Fake",
          provider: "fake",
          config: { model: "test-model", apiKey: "secret-key" }
        })
      ).isOk()
    ).toBe(true);
    expect(
      (await agent.createConversation({ id: "conversation-race", name: "已有标题" })).isOk()
    ).toBe(true);

    let releaseRead!: NormalFunc;
    let signalReadStarted!: NormalFunc;
    stores.configs.readBarrier = new Promise<void>((resolve) => (releaseRead = resolve));
    const readStarted = new Promise<void>((resolve) => (signalReadStarted = resolve));
    stores.configs.onRead = signalReadStarted;

    const firstPromise = agent.chat({
      configID: "config-race",
      conversationID: "conversation-race",
      input: "第一句"
    });
    await readStarted;
    const secondPromise = agent.chat({
      configID: "config-race",
      conversationID: "conversation-race",
      input: "第二句"
    });
    await Promise.resolve();
    releaseRead();

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect([first, second].filter((result) => result.isOk())).toHaveLength(1);
    expect([first, second].filter((result) => result.isErr())).toHaveLength(1);
    if (second.isErr()) expect(second.reason.type).toBe("conversation_busy");
  });

  it("releases an early reservation when runtime config loading fails", async () => {
    const stores = createStores();
    const provider = new FakeProvider({ responses: [response({ text: "回复" })] });
    const agent = createAgent(stores.inject, provider);
    expect(
      (await agent.createConversation({ id: "conversation-release", name: "已有标题" })).isOk()
    ).toBe(true);

    const missing = await agent.chat({
      configID: "missing-config",
      conversationID: "conversation-release",
      input: "不会运行"
    });
    expect(missing.isErr()).toBe(true);

    await createReadyConfig(agent, "config-release");
    const terminal = waitForTerminal(agent);
    const accepted = await agent.chat({
      configID: "config-release",
      conversationID: "conversation-release",
      input: "现在运行"
    });
    expect(accepted.isOk()).toBe(true);
    const event = await terminal;
    expect(event.type).toBe("done");
  });

  it("persists the user message and an incomplete assistant message after a stream failure", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new PartialErrorProvider());
    await createReadyConfig(agent, "config-partial");
    expect(
      (await agent.createConversation({ id: "conversation-partial", name: "已有标题" })).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    const accepted = await agent.chat({
      configID: "config-partial",
      conversationID: "conversation-partial",
      input: "继续生成"
    });
    expect(accepted.isOk()).toBe(true);

    const event = await terminal;
    expect(event.type).toBe("error");
    const saved = stores.conversations.values.get("conversation-partial");
    expect(saved?.messages).toEqual([
      { role: "user", content: "继续生成" },
      { role: "assistant", content: "半截回复" }
    ]);
    expect(saved?.runtime).toMatchObject({
      status: "failed",
      terminal: true,
      incomplete: true,
      error: { type: "network", message: "stream disconnected" }
    });
    expect(saved?.assistantTurns).toEqual([
      expect.objectContaining({ step: 0, messageIndex: 1, status: "incomplete" })
    ]);
    if (event.type === "error") expect(event.snapshot).toEqual(saved);
  });

  it("repairs a stale persisted running state after process restart", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new FakeProvider());
    const now = Date.now();
    stores.conversations.values.set("conversation-stale-run", {
      id: "conversation-stale-run",
      name: "未完成运行",
      createdAt: now,
      updatedAt: now,
      metadata: {},
      messages: [{ role: "user", content: "退出前的问题" }],
      runtime: {
        runID: "run-before-restart",
        status: "running",
        startedAt: now - 1_000,
        terminal: false,
        incomplete: true
      }
    });

    const result = await agent.getConversationSnapshot("conversation-stale-run");

    expect(result.unwrap()?.runtime).toMatchObject({
      runID: "run-before-restart",
      status: "aborted",
      terminal: true,
      incomplete: true,
      error: {
        type: "aborted",
        message: "上一次 Agent 运行在应用退出前未完成"
      }
    });
    expect(stores.conversations.values.get("conversation-stale-run")?.runtime?.endedAt).toEqual(
      expect.any(Number)
    );
  });

  it("falls back to the first user message when automatic title generation fails", async () => {
    const stores = createStores();
    const agent = createAgent(
      stores.inject,
      new TitleErrorProvider({ responses: [response({ text: "主回复仍然完成" })] })
    );
    const events: AIAgentEvent[] = [];
    await createReadyConfig(agent, "config-title-fallback");
    expect((await agent.createConversation({ id: "conversation-title-fallback" })).isOk()).toBe(
      true
    );

    const terminal = waitForTerminalEvent(agent, events);
    expect(
      (
        await agent.chat({
          configID: "config-title-fallback",
          conversationID: "conversation-title-fallback",
          input: "第一条消息"
        })
      ).isOk()
    ).toBe(true);

    await terminal;
    expect(events.at(-1)?.type).toBe("done");
    expect(events.find((event) => event.type === "title")).toMatchObject({
      type: "title",
      title: "第一条消息"
    });
    expect(stores.conversations.values.get("conversation-title-fallback")).toMatchObject({
      name: "第一条消息",
      messages: [
        { role: "user", content: "第一条消息" },
        { role: "assistant", content: "主回复仍然完成" }
      ]
    });
  });

  it("persists unified accumulated usage on the terminal assistant turn", async () => {
    const stores = createStores();
    const call = toolCall("call-usage");
    const provider = new FakeProvider({
      responses: [
        response({
          toolCalls: [call],
          finishReason: "tool_calls",
          usage: {
            inputTokens: 10,
            outputTokens: 2,
            totalTokens: 12,
            cachedInputTokens: 3,
            cacheWriteTokens: 4,
            reasoningTokens: 1
          }
        }),
        response({
          text: "完成",
          usage: {
            inputTokens: 20,
            outputTokens: 5,
            totalTokens: 25,
            cachedInputTokens: 6,
            cacheWriteTokens: 7,
            reasoningTokens: 2
          }
        })
      ]
    });
    const agent = createAgent(stores.inject, provider, {
      tools: { list: [new EchoTool()], strict: true, choice: "auto" }
    });
    await createReadyConfig(agent, "config-usage");
    expect(
      (await agent.createConversation({ id: "conversation-usage", name: "已有标题" })).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    expect(
      (
        await agent.chat({
          configID: "config-usage",
          conversationID: "conversation-usage",
          input: "调用工具"
        })
      ).isOk()
    ).toBe(true);
    const event = await terminal;
    expect(event.type).toBe("done");

    const turns = stores.conversations.values.get("conversation-usage")?.assistantTurns;
    expect(turns).toHaveLength(2);
    expect(turns?.[0]?.usage).toEqual({
      input: 10,
      output: 2,
      total: 12,
      cachedInput: 3,
      cacheWrite: 4,
      reasoning: 1
    });
    expect(turns?.[1]?.usage).toEqual({
      input: 30,
      output: 7,
      total: 37,
      cachedInput: 9,
      cacheWrite: 11,
      reasoning: 3
    });
    expect(stores.conversations.values.get("conversation-usage")?.runtime?.usage).toEqual({
      input: 30,
      output: 7,
      total: 37,
      cachedInput: 9,
      cacheWrite: 11,
      reasoning: 3
    });
    if (event.type === "done") {
      expect(event.response.usage).toEqual({
        inputTokens: 30,
        outputTokens: 7,
        totalTokens: 37,
        cachedInputTokens: 9,
        cacheWriteTokens: 11,
        reasoningTokens: 3
      });
    }
  });

  it("merges activated skill tools with routed tools and injects skills after the stable prefix", async () => {
    const stores = createStores();
    const provider = new FakeProvider({ responses: [response({ text: "已介绍" })] });
    const agent = createAgent(stores.inject, provider, {
      tools: {
        list: [new NamedTool("detail"), new NamedTool("base"), new NamedTool("comments")],
        strict: true,
        choice: "auto",
        select: () => ["base"]
      },
      skills: {
        list: [
          { id: "grounded", kind: "rule", instructions: "不要编造" },
          {
            id: "overview",
            kind: "skill",
            instructions: "先读取详情和评论",
            toolNames: ["comments", "detail", "comments"],
            match: ({ input }) => input.includes("介绍")
          }
        ]
      }
    });
    await createReadyConfig(agent, "config-skill-tools");
    expect(
      (
        await agent.createConversation({
          id: "conversation-skill-tools",
          name: "已有标题"
        })
      ).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    expect(
      (
        await agent.chat({
          configID: "config-skill-tools",
          conversationID: "conversation-skill-tools",
          input: "介绍当前歌曲"
        })
      ).isOk()
    ).toBe(true);
    expect((await terminal).type).toBe("done");

    const request = provider.streamRequests[0];
    expect(request?.tools?.map((tool) => tool.name)).toEqual(["detail", "base", "comments"]);
    expect(request?.messages).toEqual([
      { role: "system", content: "你是音乐助手" },
      {
        role: "system",
        content: '<agent_rule id="grounded">\n不要编造\n</agent_rule>'
      },
      {
        role: "system",
        content: '<active_skill id="overview">\n先读取详情和评论\n</active_skill>'
      },
      { role: "user", content: "介绍当前歌曲" }
    ]);
  });

  it("persists an aborted terminal state and releases the conversation", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new BlockingAbortProvider());
    await createReadyConfig(agent, "config-abort");
    expect(
      (await agent.createConversation({ id: "conversation-abort", name: "已有标题" })).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    const accepted = await agent.chat({
      configID: "config-abort",
      conversationID: "conversation-abort",
      input: "请等待"
    });
    expect(accepted.isOk()).toBe(true);
    expect(agent.abort(accepted.unwrap().runID).isOk()).toBe(true);
    expect((await terminal).type).toBe("aborted");

    const saved = stores.conversations.values.get("conversation-abort");
    expect(saved?.messages).toEqual([{ role: "user", content: "请等待" }]);
    expect(saved?.runtime).toMatchObject({
      status: "aborted",
      terminal: true,
      incomplete: true
    });

    const replay = waitForTerminal(agent);
    const next = await agent.chat({
      configID: "config-abort",
      conversationID: "conversation-abort",
      input: "再次运行"
    });
    expect(next.isOk()).toBe(true);
    expect(agent.abort(next.unwrap().runID).isOk()).toBe(true);
    expect((await replay).type).toBe("aborted");
  });

  it("persists atomic tool messages and max_steps terminal state", async () => {
    const stores = createStores();
    const provider = new FakeProvider({
      responses: [
        response({
          toolCalls: [toolCall("call-max-steps-1")],
          finishReason: "tool_calls",
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 }
        }),
        response({
          toolCalls: [toolCall("call-max-steps-2")],
          finishReason: "tool_calls",
          usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 }
        })
      ]
    });
    const agent = createAgent(stores.inject, provider, {
      maxSteps: 2,
      tools: { list: [new EchoTool()], strict: true, choice: "auto" }
    });
    await createReadyConfig(agent, "config-max-steps");
    expect(
      (await agent.createConversation({ id: "conversation-max-steps", name: "已有标题" })).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    expect(
      (
        await agent.chat({
          configID: "config-max-steps",
          conversationID: "conversation-max-steps",
          input: "一直调用工具"
        })
      ).isOk()
    ).toBe(true);
    const event = await terminal;
    expect(event.type).toBe("error");
    if (event.type === "error") expect(event.error.type).toBe("max_steps");

    const saved = stores.conversations.values.get("conversation-max-steps");
    expect(saved?.runtime).toMatchObject({ status: "max_steps", terminal: true, incomplete: true });
    expect(saved?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
      "tool"
    ]);
    expect(saved?.assistantTurns?.at(-1)?.usage).toEqual({
      input: 30,
      output: 5,
      total: 35
    });
    expect(saved && LLMConversation.fromSnapshot(saved).isOk()).toBe(true);
  });

  it("keeps a bounded sequenced replay and coalesces streaming deltas", async () => {
    const stores = createStores();
    const agent = createAgent(stores.inject, new ManyDeltaProvider(300));
    await createReadyConfig(agent, "config-replay");
    expect(
      (await agent.createConversation({ id: "conversation-replay", name: "已有标题" })).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    const accepted = await agent.chat({
      configID: "config-replay",
      conversationID: "conversation-replay",
      input: "大量事件"
    });
    expect(accepted.isOk()).toBe(true);
    await terminal;

    const replay = agent.getEventReplay(accepted.unwrap().runID);
    expect(replay).toMatchObject({ terminal: true, truncated: false });
    expect(replay?.eventReplay).toHaveLength(3);
    expect(replay?.eventReplay[0]?.event.type).toBe("started");
    expect(replay?.eventReplay[1]?.event).toMatchObject({
      type: "text_delta",
      text: "x".repeat(300)
    });
    expect(replay?.eventReplay.at(-1)?.event.type).toBe("done");
    const sequences = replay?.eventReplay.map((item) => item.sequence) ?? [];
    expect(
      sequences.every((sequence, index) => index === 0 || sequence > sequences[index - 1]!)
    ).toBe(true);

    const cursor = sequences[0]!;
    expect(agent.getEventReplay(accepted.unwrap().runID, cursor)?.eventReplay).toHaveLength(2);
  });

  it("does not persist a streamed draft that fails final-text validation", async () => {
    const stores = createStores();
    const provider = new FakeProvider({ responses: [response({ text: "未经校验的富内容" })] });
    const agent = createAgent(stores.inject, provider, {
      transformFinalText: () => {
        throw new Error("validator failed");
      }
    });
    await createReadyConfig(agent, "config-transform-failure");
    expect(
      (
        await agent.createConversation({
          id: "conversation-transform-failure",
          name: "已有标题"
        })
      ).isOk()
    ).toBe(true);

    const terminal = waitForTerminal(agent);
    const accepted = await agent.chat({
      configID: "config-transform-failure",
      conversationID: "conversation-transform-failure",
      input: "生成富内容"
    });
    expect(accepted.isOk()).toBe(true);
    const event = await terminal;

    expect(event.type).toBe("error");
    const snapshot = stores.conversations.values.get("conversation-transform-failure");
    expect(snapshot?.messages).toEqual([{ role: "user", content: "生成富内容" }]);
  });

  it("evicts old terminal replays while retaining recent runs", async () => {
    const stores = createStores();
    const provider = new FakeProvider({
      responses: Array.from({ length: 17 }, (_, index) => response({ text: `回复 ${index}` }))
    });
    const agent = createAgent(stores.inject, provider);
    await createReadyConfig(agent, "config-recent-replay");
    const runIDs: string[] = [];

    for (let index = 0; index < 17; index++) {
      const conversationID = `conversation-recent-${index}`;
      expect(
        (await agent.createConversation({ id: conversationID, name: "已有标题" })).isOk()
      ).toBe(true);
      const terminal = waitForTerminal(agent);
      const accepted = await agent.chat({
        configID: "config-recent-replay",
        conversationID,
        input: `问题 ${index}`
      });
      expect(accepted.isOk()).toBe(true);
      runIDs.push(accepted.unwrap().runID);
      await terminal;
    }

    expect(agent.listEventReplay()).toHaveLength(16);
    expect(agent.getEventReplay(runIDs[0]!)).toBeUndefined();
    expect(agent.getEventReplay(runIDs.at(-1)!)).toMatchObject({ terminal: true });
  });
});

function createAgent(
  inject: AIInject,
  provider: FakeProvider,
  options: Partial<Omit<AIAgentOptions, "inject" | "providers">> = {}
) {
  return new AIAgent({
    inject,
    providers: [provider],
    maxSteps: 2,
    systemPrompt: "你是音乐助手",
    titleMaxOutputTokens: 16,
    titlePrompt: "把用户第一句话总结成 8 个字以内的会话标题，只输出标题",
    ...options
  });
}

async function createReadyConfig(agent: AIAgent, id: string) {
  const created = await agent.createConfig({
    id,
    name: "Fake",
    provider: "fake",
    config: { model: "test-model", apiKey: "secret-key" }
  });
  expect(created.isOk()).toBe(true);
}

type TerminalAgentEvent = Extract<AIAgentEvent, { type: "done" | "error" | "aborted" }>;

function waitForTerminal(agent: AIAgent) {
  return new Promise<TerminalAgentEvent>((resolve) => {
    const unlisten = agent.listen((event) => {
      if (event.type !== "done" && event.type !== "error" && event.type !== "aborted") return;
      unlisten();
      resolve(event);
    });
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
  onRead?: NormalFunc;
  readBarrier?: Promise<void>;
  failNextWrite = false;

  async list(): Promise<AIResult<AIProviderConfigSnapshot[]>> {
    return AIResult.ok(Array.from(this.values.values(), (snapshot) => structuredClone(snapshot)));
  }

  async read(id: string): Promise<AIResult<Optional<AIProviderConfigSnapshot>>> {
    this.onRead?.();
    if (this.readBarrier) await this.readBarrier;
    const snapshot = this.values.get(id);
    return AIResult.ok(snapshot ? structuredClone(snapshot) : undefined);
  }

  async write(snapshot: AIProviderConfigSnapshot): Promise<AIResult<void>> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return AIResult.err({ type: "config_storage", message: "simulated config write failure" });
    }
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
  readonly streamRequests: LLMGenerateRequest[] = [];
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
    _config: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    this.streamRequests.push(structuredClone(request));
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

class PartialErrorProvider extends FakeProvider {
  constructor() {
    super();
  }

  override async *stream<T extends TestConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    yield AIResult.ok({ type: "text_delta", text: "半截回复" });
    yield AIResult.err({ type: "network", message: "stream disconnected" });
  }
}

class TitleErrorProvider extends FakeProvider {
  override async generate<T extends TestConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: LLMGenerateRequest
  ): Promise<AIResult<LLMGenerateResponse>> {
    return AIResult.err({ type: "network", message: "title unavailable" });
  }
}

class BlockingAbortProvider extends FakeProvider {
  constructor() {
    super();
  }

  override async *stream<T extends TestConfig>(
    _config: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    if (!request.signal?.aborted) {
      await new Promise<void>((resolve) =>
        request.signal?.addEventListener("abort", () => resolve(), { once: true })
      );
    }
    yield AIResult.err({ type: "aborted", message: "aborted by test" });
  }
}

class ManyDeltaProvider extends FakeProvider {
  constructor(private readonly count: number) {
    super();
  }

  override async *stream<T extends TestConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    for (let index = 0; index < this.count; index++) {
      yield AIResult.ok({ type: "text_delta", text: "x" });
    }
    yield AIResult.ok({
      type: "done",
      raw: {},
      text: "最终回复",
      toolCalls: [],
      finishReason: "stop"
    });
  }
}

const echoSchema = z.object({ text: z.string() });

class EchoTool extends LLMTool<typeof echoSchema, string> {
  readonly inputSchema = echoSchema;

  constructor() {
    super({ name: "echo", description: "返回输入" });
  }

  async execute(input: z.infer<typeof echoSchema>, _context: LLMToolContext) {
    void _context;
    return AIResult.ok(input.text);
  }
}

const namedToolSchema = z.object({});

class NamedTool extends LLMTool<typeof namedToolSchema, string> {
  readonly inputSchema = namedToolSchema;

  constructor(name: string) {
    super({ name, description: name });
  }

  async execute() {
    return AIResult.ok(this.name);
  }
}

function toolCall(callID: string) {
  return {
    callID,
    name: "echo",
    arguments: JSON.stringify({ text: "hello" })
  };
}
