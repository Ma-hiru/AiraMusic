import { z } from "zod";
import { AIResult } from "@/result";
import { LLMTool, LLMToolRegistry } from "@/tools";

describe("LLMToolRegistry output budget", () => {
  it("keeps small structured outputs unchanged", async () => {
    const registry = new LLMToolRegistry({ maxOutputChars: 1024 });
    expect(registry.register(new OutputTool({ ok: true, items: [1, 2, 3] })).isOk()).toBe(true);

    const result = await registry.execute(call(), context());

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().output).toBe('{"ok":true,"items":[1,2,3]}');
  });

  it("returns a valid JSON preview when a structured output exceeds the hard budget", async () => {
    const registry = new LLMToolRegistry({ maxOutputChars: 512 });
    expect(
      registry.register(new OutputTool({ items: Array.from({ length: 200 }, (_, i) => i) })).isOk()
    ).toBe(true);

    const result = await registry.execute(call(), context());

    expect(result.isOk()).toBe(true);
    const output = result.unwrap().output;
    expect(output.length).toBeLessThanOrEqual(512);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)).toMatchObject({
      _meta: {
        truncated: true,
        returnedAs: "json-preview"
      }
    });
  });

  it("marks oversized text outputs without exceeding the hard budget", async () => {
    const registry = new LLMToolRegistry({ maxOutputChars: 320 });
    expect(registry.register(new OutputTool("A".repeat(1000))).isOk()).toBe(true);

    const result = await registry.execute(call(), context());

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().output.length).toBeLessThanOrEqual(320);
    expect(result.unwrap().output).toContain("工具结果已裁剪");
  });

  it("keeps definition selection stable and exposes independent parallel/retry safety", () => {
    const registry = new LLMToolRegistry({
      parallelSafeNames: ["read"],
      retrySafeNames: ["read", "idempotent"]
    });
    registry.register([
      new OutputTool("read", { ok: true }),
      new OutputTool("write", { ok: true }),
      new OutputTool("idempotent", { ok: true })
    ]);

    expect(registry.definitions(true, ["write"]).map((tool) => tool.name)).toEqual(["write"]);
    expect(registry.definitions(true, ["write", "read"]).map((tool) => tool.name)).toEqual([
      "read",
      "write"
    ]);
    expect(registry.isParallelSafe("read")).toBe(true);
    expect(registry.isParallelSafe("write")).toBe(false);
    expect(registry.isRetrySafe("read")).toBe(true);
    expect(registry.isRetrySafe("idempotent")).toBe(true);
    expect(registry.isParallelSafe("idempotent")).toBe(false);
    expect(registry.isRetrySafe("write")).toBe(false);
  });

  it("does not execute a registered tool outside the current routed allowlist", async () => {
    const registry = new LLMToolRegistry();
    registry.register(new OutputTool("write", { changed: true }));

    const result = await registry.execute(
      { name: "write", callID: "call-1", arguments: "{}" },
      context(),
      ["read"]
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.reason.type).toBe("unknown_tool");
      expect(result.reason.message).not.toContain("本轮未启用");
      expect(result.reason.raw).toMatchObject({
        reason: "not_selected",
        visibility: "internal"
      });
    }
  });

  it("仍把完全未注册的名称报告为真实工具错误", async () => {
    const registry = new LLMToolRegistry();
    registry.register(new OutputTool("read", { ok: true }));

    const result = await registry.execute(
      { name: "missing", callID: "call-missing", arguments: "{}" },
      context(),
      ["read"]
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.reason.type).toBe("unknown_tool");
      expect(result.reason.message).toContain("未知工具");
      expect(result.reason.raw).toBeUndefined();
    }
  });

  it("normalizes a thrown tool exception into an AIResult error", async () => {
    const registry = new LLMToolRegistry();
    registry.register(new ThrowTool());

    const result = await registry.execute(
      { name: "throw", callID: "call-throw", arguments: "{}" },
      context()
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.message).toContain("tool exploded");
  });
});

class OutputTool extends LLMTool<typeof schema, unknown> {
  readonly inputSchema = schema;

  constructor(output: unknown);
  constructor(name: string, output: unknown);
  constructor(nameOrOutput: string | unknown, maybeOutput?: unknown) {
    const hasName = typeof nameOrOutput === "string" && arguments.length > 1;
    super({ name: hasName ? nameOrOutput : "output", description: "returns a test output" });
    this.output = hasName ? maybeOutput : nameOrOutput;
  }

  private readonly output: unknown;

  override async execute() {
    return AIResult.ok(this.output);
  }
}

class ThrowTool extends LLMTool<typeof schema, never> {
  readonly inputSchema = schema;

  constructor() {
    super({ name: "throw", description: "throws" });
  }

  override async execute(): Promise<AIResult<never>> {
    throw new Error("tool exploded");
  }
}

const schema = z.object({});

const call = () => ({ name: "output", callID: "call-1", arguments: "{}" });
const context = () => ({ conversationID: "conversation-1" });
