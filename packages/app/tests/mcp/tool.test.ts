import { z } from "zod";
import { Client } from "@modelcontextprotocol/client";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import type { AgentToolResponse } from "@mahiru/ipc/types";

import { MainAgentTool } from "../../src/lib/agent/tool";
import { McpToolRisk, McpToolError } from "../../src/types/tool";
const ipc = vi.hoisted(() => ({ commit: vi.fn(), listen: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@mahiru/ipc/main", () => ({ MainIPC: { MessageChannel: ipc } }));

const context = { conversationID: "thread-1", outputDetail: "standard" as const };
describe("MCP 工具构建与 renderer 调用", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listen.mockReturnValue(ipc.unsubscribe);
  });
  afterEach(() => vi.useRealTimers());

  it("SDK 只校验一次输入，保留默认值与 refine，并把 detail 分离到上下文", async () => {
    const execute = vi.fn((input) => input);
    const transform = vi.fn((value: string) => `${value}!`);
    const defaultValue = vi.fn(() => 3);
    const refine = vi.fn((value: { id: string; limit: number }, context: z.RefinementCtx) => {
      if (value.id === "denied!") context.addIssue({ code: "custom", message: "id denied" });
    });
    const tool = MainAgentTool.createMcpTool({
      name: "test",
      description: "test",
      risk: McpToolRisk.Read,
      inputSchema: z
        .object({
          id: z.string().min(1).transform(transform),
          limit: z.number().default(defaultValue)
        })
        .strict()
        .superRefine(refine),
      execute
    });
    const server = new McpServer({ name: "tool-test", version: "1.0.0" });
    const client = new Client({ name: "tool-test-client", version: "1.0.0" });
    server.registerTool(tool.name, { inputSchema: tool.inputSchema }, async (input) => {
      const result = await tool.execute(input, context);
      return MainAgentTool.formatResult(result, tool, context);
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    try {
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: tool.name,
        arguments: { id: "1", detail: "compact" }
      });
      expect(result.structuredContent).toMatchObject({ result: { id: "1!", limit: 3 } });
      expect(execute).toHaveBeenCalledWith(
        { id: "1!", limit: 3 },
        { ...context, outputDetail: "compact" }
      );
      expect(transform).toHaveBeenCalledOnce();
      expect(defaultValue).toHaveBeenCalledOnce();
      expect(refine).toHaveBeenCalledOnce();
      for (const input of [
        { id: 1 },
        { id: "" },
        { id: "denied" },
        { id: "1", detail: "invalid" }
      ]) {
        await expect(client.callTool({ name: tool.name, arguments: input })).resolves.toMatchObject(
          {
            isError: true
          }
        );
      }
      expect(execute).toHaveBeenCalledOnce();
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
    expect(MainAgentTool.getMcpToolAnnotations(tool)).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    });
  });

  it("并发响应只结算对应请求并清理监听器", async () => {
    const tool = MainAgentTool.createRendererTool({
      name: "agent-tool-player-current",
      description: "state",
      risk: McpToolRisk.Read,
      inputSchema: z.object({})
    });
    const first = tool.execute({}, context);
    const second = tool.execute({}, context);
    await vi.waitFor(() => expect(ipc.commit).toHaveBeenCalledTimes(2));
    const requests = ipc.commit.mock.calls.map(([value]) => value.data);
    const listeners = ipc.listen.mock.calls.map(
      ([, listener]) => listener as (value: AgentToolResponse) => void
    );
    for (const listener of listeners)
      listener({ id: requests[1].id, ok: true, data: { second: true } });
    for (const listener of listeners)
      listener({ id: requests[0].id, ok: true, data: { first: true } });
    await expect(first).resolves.toEqual({ first: true });
    await expect(second).resolves.toEqual({ second: true });
    expect(ipc.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("取消发送 renderer 取消消息并释放等待", async () => {
    const controller = new AbortController();
    const tool = MainAgentTool.createRendererTool({
      name: "agent-tool-player-current",
      description: "state",
      risk: McpToolRisk.Read,
      inputSchema: z.object({})
    });
    const result = tool.execute({}, { ...context, signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ code: "aborted" });
    await vi.waitFor(() => expect(ipc.commit).toHaveBeenCalledOnce());
    const id = ipc.commit.mock.calls[0]![0].data.id;
    controller.abort();
    await assertion;
    expect(ipc.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "message_cancel_agent_tool_request",
        data: { id, reason: "aborted" }
      })
    );
    expect(ipc.unsubscribe).toHaveBeenCalledOnce();
  });

  it("写操作超时标记提交状态未知，不能自动重试", async () => {
    const tool = MainAgentTool.createRendererTool({
      name: "agent-tool-player-action",
      description: "action",
      risk: McpToolRisk.Write,
      inputSchema: z.object({}),
      timeoutMs: 10
    });
    const result = tool.execute({}, context);
    const assertion = expect(result).rejects.toMatchObject({ code: "commit_unknown" });
    await vi.waitFor(() => expect(ipc.commit).toHaveBeenCalled());
    await assertion;
    expect(ipc.unsubscribe).toHaveBeenCalledOnce();
    expect(ipc.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "message_cancel_agent_tool_request" })
    );
  });

  it("已取消的请求不发送工具调用", async () => {
    const tool = MainAgentTool.createRendererTool({
      name: "agent-tool-player-current",
      description: "state",
      risk: McpToolRisk.Read,
      inputSchema: z.object({})
    });
    await expect(
      tool.execute({}, { ...context, signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ code: "aborted" });
    expect(ipc.commit).not.toHaveBeenCalled();
  });

  it("仅公共出口删除用户资料，正常共享引用仍完整保留", () => {
    const tool = MainAgentTool.createMcpTool({
      name: "user-info",
      description: "user",
      risk: McpToolRisk.Read,
      inputSchema: z.object({}),
      execute: () => null
    });
    const track = { id: 7, name: "歌曲" };
    expect(MainAgentTool.formatResult(null, tool, context).structuredContent).toMatchObject({
      result: null
    });
    const output = {
      userId: 123,
      nickname: "用户",
      avatarUrl: "https://example.com/avatar.jpg",
      current: track,
      queue: [track]
    };
    const publicResult = MainAgentTool.formatResult(output, tool, context);
    const internalResult = MainAgentTool.formatResult(output, tool, {
      ...context,
      access: "internal"
    });
    expect(publicResult.structuredContent).toEqual({
      ok: true,
      tool: tool.name,
      result: { current: track, queue: [track] }
    });
    expect(internalResult.structuredContent).toEqual({ ok: true, tool: tool.name, result: output });
    for (const result of [publicResult, internalResult]) {
      const text = result.content[0];
      expect(text?.type).toBe("text");
      if (text?.type === "text")
        expect(result.structuredContent).toEqual({
          ok: true,
          tool: tool.name,
          result: JSON.parse(text.text)
        });
    }
  });

  it("两种出口都保持 JSON 有效，并对正文与结构化结果施加同一预算", () => {
    const tool = MainAgentTool.createMcpTool({
      name: "large-result",
      description: "result",
      risk: McpToolRisk.Read,
      inputSchema: z.object({}),
      execute: () => null
    });
    const cyclic: Record<string, unknown> = { id: 1n, count: Number.NaN };
    cyclic["self"] = cyclic;
    for (const access of ["public", "internal"] as const) {
      const cyclicResult = MainAgentTool.formatResult(cyclic, tool, { ...context, access });
      expect(cyclicResult.structuredContent).toMatchObject({
        result: { id: "1", count: null, self: "[循环引用已省略]" }
      });
      const result = MainAgentTool.formatResult(
        {
          content: "正文".repeat(MainAgentTool.AiraMcpToolOutputMaxChars),
          items: Array.from({ length: 100 }, (_, id) => ({ id }))
        },
        tool,
        { ...context, access }
      );
      const text = result.content[0];
      expect(text?.type).toBe("text");
      if (text?.type === "text") {
        expect(text.text.length).toBeLessThanOrEqual(MainAgentTool.AiraMcpToolOutputMaxChars);
        expect(result.structuredContent).toEqual({
          ok: true,
          tool: tool.name,
          result: JSON.parse(text.text)
        });
      }
      expect(result.structuredContent).toMatchObject({ result: { _meta: { truncated: true } } });
    }
  });

  it("renderer 不可用可重试，写操作提交状态未知不可重试", () => {
    const tool = MainAgentTool.createRendererTool({
      name: "agent-tool-player-action",
      description: "action",
      risk: McpToolRisk.Write,
      inputSchema: z.object({})
    });
    let unavailable: unknown;
    try {
      MainAgentTool.beforeCall(tool, context, () => false);
    } catch (error) {
      unavailable = error;
    }
    expect(MainAgentTool.formatError(unavailable, tool).structuredContent).toMatchObject({
      error: { code: "renderer_unavailable", retryable: true }
    });
    expect(
      MainAgentTool.formatError(new McpToolError("commit_unknown", "未知"), tool).structuredContent
    ).toMatchObject({
      error: { code: "commit_unknown", retryable: false }
    });
  });
});
