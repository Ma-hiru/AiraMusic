import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer, type Server as HTTPServer } from "node:http";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MainWindowManager } from "@/lib/window-manager";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import type { LLMTool } from "@mahiru/ai";

import {
  registerLLMToolsAsMcp,
  createAiraMcpToolRegistry,
  type AiraMcpToolAdapterOptions
} from "./tool-adapter";
import {
  resolveAiraPublicMcpTools,
  doesAiraMcpToolRequireRenderer,
  validateAiraPublicMcpToolNames
} from "./public-tools";

export const AiraMcpHost = "127.0.0.1";
export const AiraMcpProtocolPath = "/mcp";

export interface AiraMcpServerConfig {
  /** 监听端口；0 表示由操作系统分配空闲端口，主要用于测试。 */
  port: number;
  /** 仅接受 AiraPublicMcpToolNames 中明确审核过的工具。 */
  toolNames: readonly string[];
}

export interface AiraMcpEndpoint {
  url: string;
  port: number;
  host: typeof AiraMcpHost;
}

export interface AiraMcpServerDependencies {
  createCallID(): string;
  isRendererAvailable(): boolean;
  resolveTools(names: readonly string[]): LLMTool[];
}

interface ActiveMcpRequest {
  close(): Promise<void>;
}

const DefaultDependencies: AiraMcpServerDependencies = {
  resolveTools: resolveAiraPublicMcpTools,
  isRendererAvailable: () => MainWindowManager.get("main") !== null,
  createCallID: randomUUID
};

/**
 * AiraMusic 本地 MCP 服务。
 * 服务使用无会话 Streamable HTTP，每个请求建立独立协议实例，避免客户端间串状态。
 */
export class AiraMcpServer {
  private readonly config: Readonly<AiraMcpServerConfig>;
  private readonly dependencies: AiraMcpServerDependencies;
  private readonly tools: readonly LLMTool[];
  private readonly activeRequests = new Set<ActiveMcpRequest>();
  private httpServer?: HTTPServer;
  private endpointValue?: AiraMcpEndpoint;
  private startPromise?: Promise<AiraMcpEndpoint>;
  private stopPromise?: Promise<void>;

  constructor(
    config: AiraMcpServerConfig,
    dependencies: AiraMcpServerDependencies = DefaultDependencies
  ) {
    const toolNames = validateAiraPublicMcpToolNames(config.toolNames);
    this.config = Object.freeze({ port: validatePort(config.port), toolNames });
    this.dependencies = dependencies;
    this.tools = validateResolvedTools(toolNames, dependencies.resolveTools(toolNames));
  }

  get endpoint(): undefined | AiraMcpEndpoint {
    return this.endpointValue;
  }

  start(): Promise<AiraMcpEndpoint> {
    // 停止过程中再次启动，应等待旧监听器完全释放端口后创建新实例。
    if (this.stopPromise) return this.stopPromise.then(() => this.start());
    if (this.endpointValue) return Promise.resolve(this.endpointValue);
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = undefined;
    });
    return this.startPromise;
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = this.stopInternal().finally(() => {
      this.stopPromise = undefined;
    });
    return this.stopPromise;
  }

  private async startInternal(): Promise<AiraMcpEndpoint> {
    if (this.endpointValue) return this.endpointValue;

    const registry = createAiraMcpToolRegistry(this.tools);
    const adapterOptions: AiraMcpToolAdapterOptions = {
      createCallID: this.dependencies.createCallID,
      isRendererAvailable: this.dependencies.isRendererAvailable,
      requiresRenderer: doesAiraMcpToolRequireRenderer
    };
    const expressApp = createMcpExpressApp({
      host: AiraMcpHost,
      // 只接受协议 URL 使用的回环主机名，阻断 DNS rebinding 的伪造 Host。
      allowedHosts: [AiraMcpHost]
    });

    expressApp.post(AiraMcpProtocolPath, async (request: Request, response: Response) => {
      const mcpServer = new McpServer({ name: "airamusic-mcp-server", version: "1.0.0" });
      registerLLMToolsAsMcp(mcpServer, registry, this.tools, adapterOptions);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });

      let closed = false;
      const active: ActiveMcpRequest = {
        close: async () => {
          if (closed) return;
          closed = true;
          this.activeRequests.delete(active);
          await Promise.allSettled([transport.close(), mcpServer.close()]);
        }
      };
      this.activeRequests.add(active);
      response.once("close", () => void active.close());

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(request, response, request.body);
      } catch {
        await active.close();
        if (!response.headersSent) {
          response.status(500).json(jsonRpcError("MCP 请求处理失败"));
        } else if (!response.writableEnded) {
          response.end();
        }
      }
    });

    const unsupported = (_request: Request, response: Response) => {
      response.status(405).json(jsonRpcError("无会话 MCP 端点仅接受 POST"));
    };
    expressApp.get(AiraMcpProtocolPath, unsupported);
    expressApp.delete(AiraMcpProtocolPath, unsupported);

    const httpServer = createServer(expressApp);
    this.httpServer = httpServer;
    try {
      await listen(httpServer, this.config.port);
    } catch (error) {
      this.httpServer = undefined;
      throw error;
    }

    const address = httpServer.address() as AddressInfo;
    this.endpointValue = {
      host: AiraMcpHost,
      port: address.port,
      url: `http://${AiraMcpHost}:${address.port}${AiraMcpProtocolPath}`
    };
    return this.endpointValue;
  }

  private async stopInternal(): Promise<void> {
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // 启动失败时没有可停止的监听器。
      }
    }

    const httpServer = this.httpServer;
    this.httpServer = undefined;
    this.endpointValue = undefined;
    await Promise.allSettled([...this.activeRequests].map((request) => request.close()));
    if (!httpServer?.listening) return;
    await close(httpServer);
  }
}

function validatePort(port: number): number {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`MCP 端口必须是 0 到 65535 的整数：${port}`);
  }
  return port;
}

function validateResolvedTools(names: readonly string[], tools: readonly LLMTool[]): LLMTool[] {
  const expected = new Set(names);
  const resolved = new Map(tools.map((tool) => [tool.name, tool]));
  const unexpected = tools.filter((tool) => !expected.has(tool.name)).map((tool) => tool.name);
  const missing = names.filter((name) => !resolved.has(name));
  if (unexpected.length > 0 || missing.length > 0 || tools.length !== names.length) {
    throw new Error(
      `MCP 工具解析结果不一致：缺少 ${missing.join("、") || "无"}；多出 ${unexpected.join("、") || "无"}`
    );
  }
  return names.map((name) => resolved.get(name)!);
}

function jsonRpcError(message: string) {
  return {
    jsonrpc: "2.0",
    error: { code: -32_000, message },
    id: null
  };
}

function listen(server: HTTPServer, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, AiraMcpHost);
  });
}

function close(server: HTTPServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
