import { LLMProviderOpenAI } from "@/provider";
import { LLMMinimumContextWindowTokens } from "@/model";
import {
  toResponseInput,
  normalizeResponseUsage,
  normalizeCompletionsUsage,
  toResponseProviderContext
} from "@/utils/openai";

describe("LLMProviderOpenAI config", () => {
  it("defaults legacy configs to the Responses API mode", () => {
    const provider = new LLMProviderOpenAI();

    const result = provider.parseConfig({
      model: "  gpt-5  ",
      apiKey: "  sk-test  "
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({
      model: "gpt-5",
      apiKey: "sk-test",
      apiMode: "responses",
      chatInstructionRole: "auto",
      chatTokenLimitField: "auto",
      chatStreamUsage: "auto",
      chatToolStrict: "auto",
      requiredToolChoice: "auto"
    });
  });

  it("rejects unknown API modes instead of silently routing to Responses", () => {
    const provider = new LLMProviderOpenAI();

    const result = provider.parseConfig({
      model: "gpt-5",
      apiKey: "sk-test",
      apiMode: "legacy_completions"
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.reason.type).toBe("invalid_config");
      expect(result.reason.message).toContain("apiMode");
    }
  });

  it("validates an optional context-window override", () => {
    const provider = new LLMProviderOpenAI();

    const valid = provider.parseConfig({
      model: "gpt-5",
      apiKey: "sk-test",
      contextWindowTokens: 64_000
    });
    const invalid = provider.parseConfig({
      model: "gpt-5",
      apiKey: "sk-test",
      contextWindowTokens: 0
    });
    const tooSmall = provider.parseConfig({
      model: "gpt-5",
      apiKey: "sk-test",
      contextWindowTokens: LLMMinimumContextWindowTokens - 1
    });

    expect(valid.unwrap().contextWindowTokens).toBe(64_000);
    expect(invalid.isErr()).toBe(true);
    expect(tooSmall.isErr()).toBe(true);
  });

  it("默认只对官方端点启用 required 工具选择能力", () => {
    const provider = new LLMProviderOpenAI();
    const official = provider.parseConfig({ model: "gpt-5", apiKey: "sk-test" }).unwrap();
    const compatible = provider
      .parseConfig({
        model: "legacy-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://compatible.example/v1"
      })
      .unwrap();

    expect(provider.getCapabilities(official).supportsRequiredToolChoice).toBe(true);
    expect(provider.getCapabilities(compatible).supportsRequiredToolChoice).toBe(false);
  });

  it("允许配置显式覆盖 required 工具选择能力", () => {
    const provider = new LLMProviderOpenAI();
    const compatible = provider
      .parseConfig({
        model: "compatible-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://compatible.example/v1",
        requiredToolChoice: "include"
      })
      .unwrap();
    const official = provider
      .parseConfig({
        model: "gpt-5",
        apiKey: "sk-test",
        requiredToolChoice: "omit"
      })
      .unwrap();

    expect(provider.getCapabilities(compatible).supportsRequiredToolChoice).toBe(true);
    expect(provider.getCapabilities(official).supportsRequiredToolChoice).toBe(false);
  });

  it("exposes a structured-clone-safe JSON Schema descriptor", () => {
    const provider = new LLMProviderOpenAI();
    const descriptor = provider.descriptor;
    const cloned = structuredClone(descriptor);
    const apiMode = cloned.configSchema.properties?.["apiMode"];

    expect(cloned).toEqual(descriptor);
    expect(cloned).toMatchObject({
      id: "openai",
      label: "OpenAI",
      configSchema: {
        type: "object",
        required: expect.arrayContaining(["model", "apiKey"])
      }
    });
    expect(apiMode).toMatchObject({
      type: "string",
      default: "responses",
      enum: ["responses", "chat_completions"]
    });
    expect(cloned.configSchema.properties?.["chatTokenLimitField"]).toMatchObject({
      type: "string",
      default: "auto",
      enum: ["auto", "max_completion_tokens", "max_tokens"]
    });
    expect(cloned.configSchema.properties?.["chatInstructionRole"]).toMatchObject({
      type: "string",
      default: "auto",
      enum: ["auto", "developer", "system"]
    });
    expect(cloned.configSchema.properties?.["chatStreamUsage"]).toMatchObject({
      type: "string",
      default: "auto",
      enum: ["auto", "include", "omit"]
    });
    expect(cloned.configSchema.properties?.["chatToolStrict"]).toMatchObject({
      type: "string",
      default: "auto",
      enum: ["auto", "include", "omit"]
    });
    expect(cloned.configSchema.properties?.["requiredToolChoice"]).toMatchObject({
      type: "string",
      default: "auto",
      enum: ["auto", "include", "omit"]
    });
    expect(cloned.configSchema.properties?.["contextWindowTokens"]).toMatchObject({
      type: "integer",
      minimum: LLMMinimumContextWindowTokens
    });
    expect(JSON.stringify(cloned)).not.toContain("DeepSeek");
  });
});

describe("LLMProviderOpenAI request shape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses developer and max_completion_tokens for official GPT-5 Chat requests", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", createJSONFetchMock(bodies, chatCompletionResponse("gpt-5")));
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "gpt-5",
        apiKey: "sk-test",
        apiMode: "chat_completions"
      })
      .unwrap();

    const result = await provider.generate(config, {
      maxOutputTokens: 42,
      messages: [
        { role: "system", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ],
      tools: [chatTestTool()]
    });

    expect(result.isOk()).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      model: "gpt-5",
      max_completion_tokens: 42,
      messages: [
        { role: "developer", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ],
      tools: [
        {
          type: "function",
          function: expect.objectContaining({ name: "search_music", strict: true })
        }
      ]
    });
    expect(bodies[0]).not.toHaveProperty("max_tokens");
  });

  it("uses system and max_tokens for a DeepSeek-compatible Chat request", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", createJSONFetchMock(bodies, chatCompletionResponse("deepseek-chat")));
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "deepseek-chat",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://api.deepseek.com/v1"
      })
      .unwrap();

    const result = await provider.generate(config, {
      maxOutputTokens: 42,
      messages: [
        { role: "system", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ],
      tools: [chatTestTool()]
    });

    expect(result.isOk()).toBe(true);
    expect(bodies[0]).toMatchObject({
      max_tokens: 42,
      messages: [
        { role: "system", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ]
    });
    expect(bodies[0]).not.toHaveProperty("max_completion_tokens");
    expect(bodies[0]).not.toHaveProperty("tools.0.function.strict");
  });

  it("uses the configured Chat token field during provider checks", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", createJSONFetchMock(bodies, chatCompletionResponse("legacy-model")));
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "legacy-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        chatTokenLimitField: "max_completion_tokens",
        baseURL: "https://compatible.example/v1"
      })
      .unwrap();

    const result = await provider.check(config);

    expect(result.isOk()).toBe(true);
    expect(bodies[0]).toMatchObject({ max_completion_tokens: 8 });
    expect(bodies[0]).not.toHaveProperty("max_tokens");
  });

  it("omits unsupported stream usage and tool strict fields for compatible Chat requests", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      createSSEFetchMock(bodies, [
        chatCompletionChunk("legacy-model", { role: "assistant", content: "pong" }, null),
        chatCompletionChunk("legacy-model", {}, "stop")
      ])
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "legacy-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://compatible.example/v1",
        chatInstructionRole: "developer",
        chatTokenLimitField: "max_completion_tokens"
      })
      .unwrap();

    const events = [];
    for await (const event of provider.stream(config, {
      maxOutputTokens: 42,
      messages: [
        { role: "system", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ],
      tools: [chatTestTool()]
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.isOk() && event.unwrap().type === "done")).toBe(true);
    expect(bodies[0]).toMatchObject({
      stream: true,
      max_completion_tokens: 42,
      messages: [
        { role: "developer", content: "你是音乐助手" },
        { role: "user", content: "ping" }
      ]
    });
    expect(bodies[0]).not.toHaveProperty("max_tokens");
    expect(bodies[0]).not.toHaveProperty("stream_options");
    expect(bodies[0]).not.toHaveProperty("tools.0.function.strict");
  });

  it("把兼容端点不支持的 required 工具选择降级为 auto", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      createSSEFetchMock(bodies, [
        chatCompletionChunk("legacy-model", { role: "assistant", content: "pong" }, null),
        chatCompletionChunk("legacy-model", {}, "stop")
      ])
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "legacy-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://compatible.example/v1"
      })
      .unwrap();

    for await (const event of provider.stream(config, {
      messages: [{ role: "user", content: "ping" }],
      tools: [chatTestTool()],
      toolChoice: "required"
    })) {
      // 只需消费流，断言实际发出的请求形状。
      void event;
    }

    expect(bodies[0]).toMatchObject({ tool_choice: "auto" });
  });

  it("auto-enables stream usage and tool strict for official Chat requests", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      createSSEFetchMock(bodies, [
        chatCompletionChunk("gpt-5", { role: "assistant", content: "pong" }, null),
        chatCompletionChunk("gpt-5", {}, "stop")
      ])
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "gpt-5",
        apiKey: "sk-test",
        apiMode: "chat_completions"
      })
      .unwrap();

    const events = [];
    for await (const event of provider.stream(config, {
      messages: [{ role: "user", content: "ping" }],
      tools: [chatTestTool()]
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.isOk() && event.unwrap().type === "done")).toBe(true);
    expect(bodies[0]).toMatchObject({
      stream_options: { include_usage: true },
      tools: [
        {
          type: "function",
          function: expect.objectContaining({ name: "search_music", strict: true })
        }
      ]
    });
  });

  it("allows compatible Chat endpoints to explicitly enable stream usage and tool strict", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      createSSEFetchMock(bodies, [
        chatCompletionChunk("compatible-model", { role: "assistant", content: "pong" }, null),
        chatCompletionChunk("compatible-model", {}, "stop")
      ])
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({
        model: "compatible-model",
        apiKey: "sk-test",
        apiMode: "chat_completions",
        baseURL: "https://compatible.example/v1",
        chatStreamUsage: "include",
        chatToolStrict: "include"
      })
      .unwrap();

    const events = [];
    for await (const event of provider.stream(config, {
      messages: [{ role: "user", content: "ping" }],
      tools: [chatTestTool()]
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.isOk() && event.unwrap().type === "done")).toBe(true);
    expect(bodies[0]).toMatchObject({
      stream_options: { include_usage: true },
      tools: [
        {
          type: "function",
          function: expect.objectContaining({ name: "search_music", strict: true })
        }
      ]
    });
  });

  it("accepts a Responses check truncated only by its small output limit", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      createJSONFetchMock(
        bodies,
        responsesResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" }
        })
      )
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({ model: "gpt-5", apiKey: "sk-test", apiMode: "responses" })
      .unwrap();

    const result = await provider.check(config);

    expect(result.isOk()).toBe(true);
    expect(bodies[0]).toMatchObject({
      model: "gpt-5",
      max_output_tokens: 8,
      store: false
    });
  });

  it("uses stateless Responses requests and exposes reasoning continuation", async () => {
    const bodies: Record<string, unknown>[] = [];
    const reasoningItem = responseReasoningItem();
    vi.stubGlobal(
      "fetch",
      createJSONFetchMock(
        bodies,
        responsesResponse({
          output: [reasoningItem, responseFunctionCall()]
        })
      )
    );
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({ model: "gpt-5", apiKey: "sk-test", apiMode: "responses" })
      .unwrap();

    const result = await provider.generate(config, {
      messages: [{ role: "user", content: "搜索 Aira" }],
      tools: [
        {
          name: "search_music",
          description: "搜索音乐",
          strict: true,
          inputSchema: { type: "object", properties: {} }
        }
      ]
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().providerContext).toEqual({
      provider: "openai.responses",
      data: { reasoningItems: [reasoningItem] }
    });
    expect(bodies[0]).toMatchObject({
      store: false,
      include: ["reasoning.encrypted_content"]
    });
  });

  it("replays streamed Responses reasoning context in the next tool step", async () => {
    const bodies: Record<string, unknown>[] = [];
    const reasoningItem = responseReasoningItem();
    const firstResponse = responsesResponse({
      output: [reasoningItem, responseFunctionCall()]
    });
    vi.stubGlobal("fetch", createSSEFetchMock(bodies, [responsesCompletedEvent(firstResponse)]));
    const provider = new LLMProviderOpenAI();
    const config = provider
      .parseConfig({ model: "gpt-5", apiKey: "sk-test", apiMode: "responses" })
      .unwrap();

    const firstEvents = [];
    for await (const event of provider.stream(config, {
      messages: [{ role: "user", content: "搜索 Aira" }]
    })) {
      firstEvents.push(event);
    }
    const firstDone = firstEvents.find((event) => event.isOk() && event.unwrap().type === "done");
    expect(firstDone?.isOk()).toBe(true);
    if (!firstDone?.isOk()) return;
    const firstDoneEvent = firstDone.unwrap();
    if (firstDoneEvent.type !== "done") return;

    vi.stubGlobal(
      "fetch",
      createSSEFetchMock(bodies, [responsesCompletedEvent(responsesResponse())])
    );
    const secondEvents = [];
    for await (const event of provider.stream(config, {
      messages: [
        {
          role: "assistant",
          providerContext: firstDoneEvent.providerContext,
          toolCalls: [
            {
              name: "search_music",
              callID: "call_1",
              arguments: '{"keyword":"Aira"}'
            }
          ]
        },
        {
          role: "tool",
          name: "search_music",
          callID: "call_1",
          content: '["Aira"]'
        }
      ]
    })) {
      secondEvents.push(event);
    }

    expect(secondEvents.some((event) => event.isOk() && event.unwrap().type === "done")).toBe(true);
    expect(bodies[1]).toMatchObject({
      store: false,
      include: ["reasoning.encrypted_content"],
      input: [
        reasoningItem,
        {
          type: "function_call",
          call_id: "call_1",
          name: "search_music",
          arguments: '{"keyword":"Aira"}'
        },
        {
          type: "function_call_output",
          call_id: "call_1",
          output: '["Aira"]'
        }
      ]
    });
  });
});

describe("OpenAI usage normalization", () => {
  it("maps Responses cached input and reasoning tokens", () => {
    const result = normalizeResponseUsage({
      input_tokens: 120,
      output_tokens: 30,
      total_tokens: 150,
      input_tokens_details: { cached_tokens: 80 },
      output_tokens_details: { reasoning_tokens: 12 }
    });

    expect(result.unwrap()).toEqual({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cachedInputTokens: 80,
      reasoningTokens: 12
    });
    expect(result.unwrap().cacheWriteTokens).toBeUndefined();
  });

  it("accepts Responses usage from compatible endpoints without detail objects", () => {
    const result = normalizeResponseUsage({
      input_tokens: 120,
      output_tokens: 30,
      total_tokens: 150
    } as Parameters<typeof normalizeResponseUsage>[0]);

    expect(result.unwrap()).toEqual({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150
    });
  });

  it("maps Chat Completions details only when the SDK exposes them", () => {
    const result = normalizeCompletionsUsage({
      prompt_tokens: 90,
      completion_tokens: 20,
      total_tokens: 110,
      prompt_tokens_details: { cached_tokens: 64 },
      completion_tokens_details: { reasoning_tokens: 8 }
    });

    expect(result.unwrap()).toEqual({
      inputTokens: 90,
      outputTokens: 20,
      totalTokens: 110,
      cachedInputTokens: 64,
      reasoningTokens: 8
    });
    expect(result.unwrap().cacheWriteTokens).toBeUndefined();
  });

  it("preserves newer OpenAI cache-write usage before the SDK type catches up", () => {
    const result = normalizeCompletionsUsage({
      prompt_tokens: 90,
      completion_tokens: 20,
      total_tokens: 110,
      prompt_tokens_details: { cached_tokens: 64, cache_write_tokens: 16 }
    } as Parameters<typeof normalizeCompletionsUsage>[0]);

    expect(result.unwrap()).toMatchObject({
      cachedInputTokens: 64,
      cacheWriteTokens: 16
    });
  });

  it("maps DeepSeek's OpenAI-compatible prompt cache hit field", () => {
    const result = normalizeCompletionsUsage({
      prompt_tokens: 90,
      completion_tokens: 20,
      total_tokens: 110,
      prompt_cache_hit_tokens: 48
    } as Parameters<typeof normalizeCompletionsUsage>[0]);

    expect(result.unwrap().cachedInputTokens).toBe(48);
  });
});

describe("OpenAI Responses continuation", () => {
  it("returns preserved reasoning items before function calls and their outputs", () => {
    const reasoningItem = {
      id: "rs_1",
      type: "reasoning" as const,
      summary: [],
      status: "completed" as const,
      encrypted_content: "encrypted-reasoning"
    };
    const providerContext = toResponseProviderContext(
      responsesResponse({
        output: [
          reasoningItem,
          {
            id: "fc_1",
            type: "function_call",
            call_id: "call_1",
            name: "search_music",
            arguments: '{"keyword":"Aira"}',
            status: "completed"
          }
        ]
      }) as unknown as Parameters<typeof toResponseProviderContext>[0]
    );

    const input = toResponseInput([
      {
        role: "assistant",
        toolCalls: [
          {
            name: "search_music",
            callID: "call_1",
            arguments: '{"keyword":"Aira"}'
          }
        ],
        ...(providerContext ? { providerContext } : {})
      },
      {
        role: "tool",
        name: "search_music",
        callID: "call_1",
        content: '["Aira"]'
      }
    ]);

    expect(input).toEqual([
      reasoningItem,
      {
        type: "function_call",
        call_id: "call_1",
        name: "search_music",
        arguments: '{"keyword":"Aira"}'
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output: '["Aira"]'
      }
    ]);
  });
});

function chatTestTool() {
  return {
    name: "search_music",
    description: "搜索音乐",
    strict: true,
    inputSchema: {
      type: "object",
      properties: { keyword: { type: "string" } },
      required: ["keyword"],
      additionalProperties: false
    }
  };
}

function createJSONFetchMock(
  bodies: Record<string, unknown>[],
  responseBody: Record<string, unknown>
) {
  return vi.fn(async (_input: URL | string | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
}

function createSSEFetchMock(bodies: Record<string, unknown>[], events: Record<string, unknown>[]) {
  return vi.fn(async (_input: URL | string | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const data = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
    return new Response(data, {
      status: 200,
      headers: { "content-type": "text/event-stream" }
    });
  });
}

function chatCompletionResponse(model: string) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model,
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: "stop",
        message: { role: "assistant", content: "pong", refusal: null }
      }
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  };
}

function chatCompletionChunk(
  model: string,
  delta: Record<string, unknown>,
  finishReason: null | string
) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model,
    choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }]
  };
}

function responsesResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "resp-test",
    object: "response",
    created_at: 0,
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: "gpt-5",
    output: [],
    output_text: "",
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: null,
    store: false,
    temperature: null,
    text: { format: { type: "text" } },
    tool_choice: "auto",
    tools: [],
    top_p: null,
    truncation: "disabled",
    usage: null,
    user: null,
    metadata: {},
    ...overrides
  };
}

function responseReasoningItem() {
  return {
    id: "rs_1",
    type: "reasoning",
    summary: [],
    status: "completed",
    encrypted_content: "encrypted-reasoning"
  };
}

function responseFunctionCall() {
  return {
    id: "fc_1",
    type: "function_call",
    call_id: "call_1",
    name: "search_music",
    arguments: '{"keyword":"Aira"}',
    status: "completed"
  };
}

function responsesCompletedEvent(response: Record<string, unknown>) {
  return {
    type: "response.completed",
    sequence_number: 0,
    response
  };
}
