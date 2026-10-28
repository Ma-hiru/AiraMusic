import { z } from "zod";
import { request as httpRequest } from "node:http";
import {
  Client,
  type CallToolResult,
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/client";
import { MainAgentTool } from "@mahiru/app/lib/agent/tool";
import { McpToolRisk, type McpTool, McpToolError } from "@mahiru/app/types/tool";
import { MainAgentMcpServer, type MainAgentMcpServerOptions } from "@mahiru/app/lib/agent/server";

vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: { MessageChannel: { commit: vi.fn(), listen: vi.fn() } }
}));

const SearchInputSchema = z.object({ query: z.string().min(1) });
const running: MainAgentMcpServer[] = [];

class FakeSearchTool implements McpTool {
  readonly risk = McpToolRisk.Read;
  readonly execution = "renderer";
  readonly timeoutMs = 20_000;
  readonly openWorld = false;
  readonly description = "查询公开音乐资料";
  readonly inputSchema = SearchInputSchema;
  calls = 0;

  constructor(
    private readonly output: JsonValue,
    readonly name = "agent-search"
  ) {}

  async execute(): Promise<JsonValue> {
    this.calls += 1;
    return this.output;
  }
}

describe("Aira MCP Streamable HTTP 服务", () => {
  afterEach(async () => {
    await Promise.allSettled(running.splice(0).map((server) => server.stop()));
  });

  it("只绑定回环地址，且启动和停止均幂等", async () => {
    const server = createServer([new FakeSearchTool({ answer: "ok" })]);
    const firstStart = server.start();
    const secondStart = server.start();
    expect(secondStart).toBe(firstStart);

    const [first, second] = await Promise.all([firstStart, secondStart]);
    expect(second).toEqual(first);
    expect(first.host).toBe("127.0.0.1");
    expect(first.url).toBe("http://127.0.0.1:" + first.port + "/mcp");

    const firstStop = server.stop();
    const secondStop = server.stop();
    expect(secondStop).toBe(firstStop);
    await Promise.all([firstStop, secondStop]);
    await expect(server.stop()).resolves.toBeUndefined();
    expect(server.endpoint).toBeUndefined();
  });

  it("停止后可以重新启动并继续提供工具", async () => {
    const tool = new FakeSearchTool({ answer: "restarted" });
    const server = createServer([tool]);
    await server.start();
    await server.stop();
    const endpoint = await server.start();
    const client = await connectClient(endpoint.url);

    try {
      expect((await client.listTools()).tools.map((item) => item.name)).toEqual(["agent-search"]);
      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "Aira" }
      });
      expect(result.structuredContent).toMatchObject({ result: { answer: "restarted" } });
      expect(tool.calls).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("通过最新 MCP 客户端列出并调用转换后的工具", async () => {
    const tool = new FakeSearchTool({ answer: "公开结果" });
    const endpoint = await createServer([tool]).start();
    const client = await connectClient(endpoint.url);

    try {
      const list = await client.listTools();
      expect(list.tools.map((item) => item.name)).toEqual(["agent-search"]);
      expect(list.tools[0]?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      });

      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "Aira" }
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: true,
        tool: tool.name,
        result: { answer: "公开结果" }
      });
      expect(tool.calls).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("renderer 不可用时立即返回结构化错误且不分发工具", async () => {
    const tool = new FakeSearchTool({ answer: "不会执行" });
    const endpoint = await createServer([tool], false).start();
    const client = await connectClient(endpoint.url);

    try {
      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "Aira" }
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: false,
        error: { code: "renderer_unavailable", retryable: true }
      });
      expect(tool.calls).toBe(0);
    } finally {
      await client.close();
    }
  });

  it("工具正文继续经过应用注入的字符预算", async () => {
    const tool = new FakeSearchTool("x".repeat(MainAgentTool.AiraMcpToolOutputMaxChars * 2));
    const endpoint = await createServer([tool]).start();
    const client = await connectClient(endpoint.url);

    try {
      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "Aira" }
      });
      const text = readFirstTextContent(result);
      expect(text.length).toBeLessThanOrEqual(MainAgentTool.AiraMcpToolOutputMaxChars);
      expect(text).toContain("工具结果已裁剪");
      expect(result.structuredContent).toMatchObject({ result: text });
    } finally {
      await client.close();
    }
  });

  it("公开结果递归移除用户资料，同时保留音乐字段", async () => {
    const tool = new FakeSearchTool({
      id: 42,
      name: "公开歌单",
      creator: {
        userId: 1001,
        nickname: "不应泄露的创建者",
        avatarUrl: "https://example.com/private-avatar.jpg"
      },
      subscribers: [
        { profile: { signature: "不应泄露的签名" }, user: { email: "private@example.com" } }
      ],
      tracks: [{ id: 7, name: "保留的歌曲", artist: "保留的歌手" }]
    });
    const endpoint = await createServer([tool]).start();
    const client = await connectClient(endpoint.url);

    try {
      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "公开歌单" }
      });
      expect(result.structuredContent).toMatchObject({
        ok: true,
        result: {
          id: 42,
          name: "公开歌单",
          tracks: [{ id: 7, name: "保留的歌曲", artist: "保留的歌手" }]
        }
      });
      expect(readFirstTextContent(result)).toContain("保留的歌曲");
      expect(JSON.stringify(result)).not.toMatch(
        /creator|subscriber|profile|userId|nickname|avatar|signature|private@example/i
      );
    } finally {
      await client.close();
    }
  });

  it("同一端点按注入策略区分工具目录，内部结果保留用户资料", async () => {
    const publicTool = new FakeSearchTool({ answer: "public" });
    const internalTool = new FakeSearchTool(
      { profile: { nickname: "内部资料" }, answer: "internal" },
      "agent-tool-player-action"
    );
    const endpoint = await createServer([publicTool], true, {
      resolveScope: (request) =>
        request.headers.get("authorization") === "Bearer internal-secret"
          ? { tools: [publicTool, internalTool], access: "internal" }
          : { tools: [publicTool], access: "public" }
    }).start();
    const publicClient = await connectClient(endpoint.url);
    const invalidClient = await connectClient(endpoint.url, "wrong-secret");
    const internalClient = await connectClient(endpoint.url, "internal-secret");

    try {
      expect((await publicClient.listTools()).tools.map((tool) => tool.name)).toEqual([
        publicTool.name
      ]);
      expect((await invalidClient.listTools()).tools.map((tool) => tool.name)).toEqual([
        publicTool.name
      ]);
      expect((await internalClient.listTools()).tools.map((tool) => tool.name)).toEqual([
        publicTool.name,
        internalTool.name
      ]);
      await expect(
        publicClient.callTool({ name: internalTool.name, arguments: { query: "Aira" } })
      ).rejects.toThrow(/not found/i);
      expect(internalTool.calls).toBe(0);

      const result = await internalClient.callTool({
        name: internalTool.name,
        arguments: { query: "Aira" }
      });
      expect(result.structuredContent).toMatchObject({
        result: { profile: { nickname: "内部资料" }, answer: "internal" }
      });
      expect(readFirstTextContent(result)).toContain("内部资料");
    } finally {
      await Promise.allSettled([
        publicClient.close(),
        invalidClient.close(),
        internalClient.close()
      ]);
    }
  });

  it("公开目录为空时仍能列出空目录，内部 Agent 可以使用工具", async () => {
    const internalTool = new FakeSearchTool({ answer: "internal" });
    const endpoint = await createServer([], true, {
      resolveScope: (request) =>
        request.headers.get("authorization") === "Bearer internal-secret"
          ? { tools: [internalTool], access: "internal" }
          : { tools: [], access: "public" }
    }).start();
    const publicClient = await connectClient(endpoint.url);
    const internalClient = await connectClient(endpoint.url, "internal-secret");

    try {
      await expect(publicClient.listTools()).resolves.toMatchObject({ tools: [] });
      await expect(internalClient.listTools()).resolves.toMatchObject({
        tools: [{ name: internalTool.name }]
      });
      const result = await internalClient.callTool({
        name: internalTool.name,
        arguments: { query: "Aira" }
      });
      expect(result.structuredContent).toMatchObject({ result: { answer: "internal" } });
    } finally {
      await Promise.allSettled([publicClient.close(), internalClient.close()]);
    }
  });

  it("SDK 拒绝非法输入且只解析一次 transform，执行器收到解析后的参数", async () => {
    const transform = vi.fn((query: string) => query + "!");
    const execute = vi.fn((input: { query: string }) => ({ answer: input.query }));
    const tool = MainAgentTool.createMcpTool({
      name: "agent-transform",
      description: "验证输入解析边界",
      risk: McpToolRisk.Read,
      inputSchema: z.object({ query: z.string().min(1).transform(transform) }),
      execute
    });
    const endpoint = await createServer([tool]).start();
    const client = await connectClient(endpoint.url);

    try {
      const invalid = await client.callTool({
        name: tool.name,
        arguments: { query: 42 }
      });
      expect(invalid.isError).toBe(true);
      expect(readFirstTextContent(invalid)).toMatch(/validation|invalid arguments/i);
      expect(execute).not.toHaveBeenCalled();
      expect(transform).not.toHaveBeenCalled();

      const result = await client.callTool({
        name: tool.name,
        arguments: { query: "Aira", detail: "compact" }
      });
      expect(result.structuredContent).toMatchObject({ result: { answer: "Aira!" } });
      expect(transform).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledExactlyOnceWith(
        { query: "Aira!" },
        expect.objectContaining({ outputDetail: "compact", access: "public" })
      );
    } finally {
      await client.close();
    }
  });

  it("拒绝伪造 Host，且不会执行工具", async () => {
    const tool = new FakeSearchTool({ answer: "ok" });
    const endpoint = await createServer([tool]).start();

    const response = await postWithHost(endpoint.port, "evil.example");
    expect(response.status).toBe(403);
    expect(response.body).toContain("Invalid Host");
    expect(tool.calls).toBe(0);
  });

  it("拒绝非本地 Origin，且不会执行工具", async () => {
    const tool = new FakeSearchTool({ answer: "ok" });
    const endpoint = await createServer([tool]).start();
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        origin: "https://evil.example"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool.name, arguments: { query: "Aira" } }
      })
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Origin");
    expect(tool.calls).toBe(0);
  });

  it("通过 TCP 兼容 2025 initialize、initialized、tools/list 和 tools/call", async () => {
    const tool = new FakeSearchTool({ answer: "legacy" });
    const endpoint = await createServer([tool]).start();
    const initialized = await postLegacy(endpoint.url, 1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "rmcp-legacy-wire-test", version: "1.0.0" }
    });
    expect(initialized.status).toBe(200);
    expect(initialized.message.result).toMatchObject({
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} }
    });

    const notification = await fetch(endpoint.url, {
      method: "POST",
      headers: legacyHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });
    expect(notification.status).toBe(202);

    const listed = await postLegacy(endpoint.url, 2, "tools/list");
    expect(listed.message.result).toMatchObject({ tools: [{ name: tool.name }] });
    const called = await postLegacy(endpoint.url, 3, "tools/call", {
      name: tool.name,
      arguments: { query: "Aira" }
    });
    expect(called.message.result).toMatchObject({
      structuredContent: { ok: true, result: { answer: "legacy" } }
    });
    expect(tool.calls).toBe(1);
  });

  it.each(["modern", "legacy"] as const)(
    "停止服务会中断在途 %s 工具并取消执行信号",
    async (protocol) => {
      const started = Promise.withResolvers<AbortSignal>();
      const aborted = Promise.withResolvers<void>();
      const tool = MainAgentTool.createMcpTool({
        name: "agent-pending",
        description: "等待服务关闭",
        risk: McpToolRisk.Read,
        inputSchema: z.object({}),
        execute: (_input, context) =>
          new Promise<never>((_resolve, reject) => {
            const signal = context.signal!;
            started.resolve(signal);
            signal.addEventListener(
              "abort",
              () => {
                aborted.resolve();
                reject(new McpToolError("aborted", "工具请求已取消"));
              },
              { once: true }
            );
          })
      });
      const server = createServer([tool]);
      const endpoint = await server.start();
      const client = protocol === "modern" ? await connectClient(endpoint.url) : undefined;
      const pending = (
        client
          ? client.callTool({ name: tool.name, arguments: {} })
          : postLegacy(endpoint.url, 1, "tools/call", { name: tool.name, arguments: {} })
      ).then(
        () => "resolved",
        () => "rejected"
      );

      try {
        const signal = await started.promise;
        await server.stop();
        await aborted.promise;
        expect(signal.aborted).toBe(true);
        expect(await pending).toBe("rejected");
        expect(server.endpoint).toBeUndefined();
      } finally {
        await client?.close();
      }
    }
  );
});

function createServer(
  tools: readonly McpTool[],
  rendererAvailable = true,
  options: Partial<MainAgentMcpServerOptions> = {}
): MainAgentMcpServer {
  const server = new MainAgentMcpServer({
    port: 0,
    tools,
    beforeCall: (tool, context) => MainAgentTool.beforeCall(tool, context, () => rendererAvailable),
    mapResult: (output, tool, context) => MainAgentTool.formatResult(output, tool, context),
    mapError: (error, tool) => MainAgentTool.formatError(error, tool),
    ...options
  });
  running.push(server);
  return server;
}

async function connectClient(url: string, token?: string): Promise<Client> {
  const client = new Client({ name: "airamusic-mcp-test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      ...(token ? { requestInit: { headers: { Authorization: "Bearer " + token } } } : {})
    })
  );
  return client;
}

function postWithHost(port: number, host: string): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: { host, "content-type": "application/json" }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.on("end", () => resolve({ body, status: response.statusCode ?? 0 }));
      }
    );
    request.once("error", reject);
    request.end("{}");
  });
}

const legacyHeaders = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-11-25"
};

interface LegacyReply {
  id: number;
  error?: unknown;
  result?: Record<string, unknown>;
}

async function postLegacy(
  url: string,
  id: number,
  method: string,
  params?: Record<string, unknown>
): Promise<{ status: number; message: LegacyReply }> {
  const response = await fetch(url, {
    method: "POST",
    headers: legacyHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })
  });
  const body = await response.text();
  const messages: LegacyReply[] = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? body
        .split(/\r?\n\r?\n/)
        .map((event) =>
          event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n")
        )
        .filter(Boolean)
        .map((data) => JSON.parse(data) as LegacyReply)
    : [JSON.parse(body) as LegacyReply];
  const message = messages.find((item) => item.id === id);
  if (!message) throw new Error("缺少 JSON-RPC 响应：" + body.slice(0, 500));
  return { status: response.status, message };
}

function readFirstTextContent(result: CallToolResult): string {
  return result.content.find((item) => item.type === "text")?.text ?? "";
}
