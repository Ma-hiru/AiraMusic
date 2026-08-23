import { z } from "zod";
import { request as httpRequest } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LLMTool, AIResult } from "@mahiru/agent";
import {
  AiraMcpServer,
  AiraMcpToolOutputMaxChars,
  type AiraMcpServerDependencies
} from "@mahiru/app/inner/mcp";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), off: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {
    static fromWebContents = vi.fn();
  }
}));

vi.mock("@/lib/window-manager", () => ({
  MainWindowManager: { get: vi.fn(() => null) }
}));

const SearchInputSchema = z.object({ query: z.string().min(1) });

class FakeSearchTool extends LLMTool<typeof SearchInputSchema, JsonValue> {
  readonly inputSchema = SearchInputSchema;
  calls = 0;

  constructor(
    private readonly output: JsonValue,
    name = "agent-search"
  ) {
    super({ name, description: "查询公开音乐资料" });
  }

  async execute(): Promise<AIResult<JsonValue>> {
    this.calls += 1;
    return AIResult.ok(this.output);
  }
}

describe("Aira MCP Streamable HTTP 服务", () => {
  const running: AiraMcpServer[] = [];

  afterEach(async () => {
    await Promise.allSettled(running.splice(0).map((server) => server.stop()));
  });

  it("只绑定回环地址，且启动和停止均幂等", async () => {
    const tool = new FakeSearchTool({ answer: "ok" });
    const server = createServer(tool, true);
    running.push(server);

    const firstStart = server.start();
    const secondStart = server.start();
    expect(secondStart).toBe(firstStart);

    const [first, second] = await Promise.all([firstStart, secondStart]);
    expect(second).toEqual(first);
    expect(first.host).toBe("127.0.0.1");
    expect(first.url).toBe(`http://127.0.0.1:${first.port}/mcp`);

    const firstStop = server.stop();
    const secondStop = server.stop();
    expect(secondStop).toBe(firstStop);
    await Promise.all([firstStop, secondStop]);
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("通过 MCP 客户端列出并调用转换后的 LLMTool", async () => {
    const tool = new FakeSearchTool({ answer: "公开结果" });
    const server = createServer(tool, true);
    running.push(server);
    const endpoint = await server.start();
    const client = await connectClient(endpoint.url);

    try {
      const list = await client.listTools();
      expect(list.tools.map((item) => item.name)).toEqual(["agent-search"]);
      expect(list.tools[0]?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      });

      const result = await client.callTool(
        {
          name: "agent-search",
          arguments: { query: "Aira" }
        },
        CallToolResultSchema
      );
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: true,
        tool: "agent-search",
        result: { answer: "公开结果" }
      });
      expect(tool.calls).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("renderer 不可用时立即返回结构化错误且不分发工具", async () => {
    const tool = new FakeSearchTool({ answer: "不会执行" });
    const server = createServer(tool, false);
    running.push(server);
    const endpoint = await server.start();
    const client = await connectClient(endpoint.url);

    try {
      const startedAt = performance.now();
      const result = await client.callTool(
        {
          name: "agent-search",
          arguments: { query: "Aira" }
        },
        CallToolResultSchema
      );
      expect(performance.now() - startedAt).toBeLessThan(1_000);
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

  it("工具正文继续经过现有 LLMToolRegistry 字符预算", async () => {
    const tool = new FakeSearchTool("x".repeat(AiraMcpToolOutputMaxChars * 2));
    const server = createServer(tool, true);
    running.push(server);
    const endpoint = await server.start();
    const client = await connectClient(endpoint.url);

    try {
      const result = await client.callTool(
        {
          name: "agent-search",
          arguments: { query: "Aira" }
        },
        CallToolResultSchema
      );
      const text = readFirstTextContent(result);
      expect(text.length).toBeLessThanOrEqual(AiraMcpToolOutputMaxChars);
      expect(text).toContain("工具结果已裁剪");
    } finally {
      await client.close();
    }
  });

  it("递归移除公共歌单结果中的用户资料，同时保留音乐字段", async () => {
    const tool = new FakeSearchTool({
      id: 42,
      name: "公开歌单",
      creator: {
        userId: 1001,
        nickname: "不应泄露的创建者",
        avatarUrl: "https://example.com/private-avatar.jpg"
      },
      subscribers: [
        {
          profile: { signature: "不应泄露的签名" },
          user: { email: "private@example.com" }
        }
      ],
      tracks: [{ id: 7, name: "保留的歌曲", artist: "保留的歌手" }]
    });
    const server = createServer(tool, true);
    running.push(server);
    const endpoint = await server.start();
    const client = await connectClient(endpoint.url);

    try {
      const result = await client.callTool(
        {
          name: "agent-search",
          arguments: { query: "公开歌单" }
        },
        CallToolResultSchema
      );
      const text = readFirstTextContent(result);
      expect(result.structuredContent).toMatchObject({
        ok: true,
        result: {
          id: 42,
          name: "公开歌单",
          tracks: [{ id: 7, name: "保留的歌曲", artist: "保留的歌手" }]
        }
      });
      expect(text).toContain("保留的歌曲");
      expect(text).not.toMatch(
        /creator|subscriber|profile|userId|nickname|avatar|signature|private@example/i
      );
      expect(JSON.stringify(result.structuredContent)).not.toMatch(
        /creator|subscriber|profile|userId|nickname|avatar|signature|private@example/i
      );
    } finally {
      await client.close();
    }
  });

  it("拒绝伪造 Host，避免本地端点遭 DNS rebinding", async () => {
    const tool = new FakeSearchTool({ answer: "ok" });
    const server = createServer(tool, true);
    running.push(server);
    const endpoint = await server.start();

    const response = await postWithHost(endpoint.port, "evil.example");
    expect(response.status).toBe(403);
    expect(response.body).toContain("Invalid Host");
    expect(tool.calls).toBe(0);
  });

  it("同一端点仅向内部 bearer token 开放完整工具目录", async () => {
    const publicTool = new FakeSearchTool({ answer: "public" });
    const dangerousTool = new FakeSearchTool({ answer: "internal" }, "agent-tool-player-action");
    const tools = new Map([publicTool, dangerousTool].map((tool) => [tool.name, tool]));
    const dependencies: AiraMcpServerDependencies = {
      resolveTools: (names) => names.map((name) => tools.get(name)!),
      isRendererAvailable: () => true,
      createCallID: () => crypto.randomUUID()
    };
    const server = new AiraMcpServer(
      {
        port: 0,
        toolNames: ["agent-search"],
        internalToken: "internal-secret",
        internalToolNames: ["agent-search", "agent-tool-player-action"]
      },
      dependencies
    );
    running.push(server);
    const endpoint = await server.start();
    const publicClient = await connectClient(endpoint.url);
    const invalidClient = await connectClient(endpoint.url, "wrong-secret");
    const internalClient = await connectClient(endpoint.url, "internal-secret");

    try {
      await expect(publicClient.listTools()).resolves.toMatchObject({
        tools: [{ name: "agent-search" }]
      });
      await expect(invalidClient.listTools()).resolves.toMatchObject({
        tools: [{ name: "agent-search" }]
      });
      expect((await internalClient.listTools()).tools.map((tool) => tool.name)).toEqual([
        "agent-search",
        "agent-tool-player-action"
      ]);
    } finally {
      await Promise.allSettled([
        publicClient.close(),
        invalidClient.close(),
        internalClient.close()
      ]);
    }
  });

  it("公开 MCP 关闭时匿名目录为空但内部 Agent 仍可使用工具", async () => {
    const internalTool = new FakeSearchTool({ answer: "internal" });
    const server = new AiraMcpServer(
      {
        port: 0,
        toolNames: [],
        internalToken: "internal-secret",
        internalToolNames: ["agent-search"]
      },
      {
        resolveTools: (names) => {
          if (names.length === 0) throw new Error("不应解析空的公共工具目录");
          return names.map(() => internalTool);
        },
        isRendererAvailable: () => true,
        createCallID: () => crypto.randomUUID()
      }
    );
    running.push(server);
    const endpoint = await server.start();
    const publicClient = await connectClient(endpoint.url);
    const internalClient = await connectClient(endpoint.url, "internal-secret");

    try {
      await expect(publicClient.listTools()).resolves.toMatchObject({ tools: [] });
      await expect(internalClient.listTools()).resolves.toMatchObject({
        tools: [{ name: "agent-search" }]
      });
    } finally {
      await Promise.allSettled([publicClient.close(), internalClient.close()]);
    }
  });
});

function createServer(tool: FakeSearchTool, rendererAvailable: boolean): AiraMcpServer {
  const dependencies: AiraMcpServerDependencies = {
    resolveTools: () => [tool],
    isRendererAvailable: () => rendererAvailable,
    createCallID: () => crypto.randomUUID()
  };
  return new AiraMcpServer({ port: 0, toolNames: ["agent-search"] }, dependencies);
}

async function connectClient(url: string, token?: string): Promise<Client> {
  const client = new Client({ name: "airamusic-mcp-test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      ...(token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {})
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

function readFirstTextContent(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as Record<string, unknown>)["content"];
  if (!Array.isArray(content)) return "";
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record["type"] === "text" && typeof record["text"] === "string") {
      return record["text"];
    }
  }
  return "";
}
