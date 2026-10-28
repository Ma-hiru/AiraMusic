import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { createServer, type Server as HTTPServer } from "node:http";
import {
  McpServer,
  createMcpHandler,
  type CallToolResult,
  type McpHttpHandler
} from "@modelcontextprotocol/server";
import { McpToolRisk, type McpTool, type McpToolContext } from "@/types/tool";
import type { AddressInfo } from "node:net";

export const MainMcpHost = "127.0.0.1";
export const MainMcpProtocolPath = "/mcp";

export interface MainAgentMcpEndpoint {
  url: string;
  port: number;
  host: typeof MainMcpHost;
}

export interface MainAgentMcpToolScope {
  tools: readonly McpTool[];
  access: "public" | "internal";
}

export interface MainAgentMcpServerOptions {
  port: number;
  tools: readonly McpTool[];
  resolveScope?(request: Request): MainAgentMcpToolScope;
  beforeCall?(tool: McpTool, context: McpToolContext): void | Promise<void>;
  mapError?(error: unknown, tool: McpTool): CallToolResult | Promise<CallToolResult>;
  mapResult?(
    output: unknown,
    tool: McpTool,
    context: McpToolContext
  ): CallToolResult | Promise<CallToolResult>;
}

/** HTTP 监听由应用管理，请求实例、协议及清理由 SDK 管理 */
export class MainAgentMcpServer {
  private httpServer?: HTTPServer;
  private handler?: McpHttpHandler;
  private endpointValue?: MainAgentMcpEndpoint;
  private starting?: Promise<MainAgentMcpEndpoint>;
  private stopping?: Promise<void>;

  constructor(private readonly options: MainAgentMcpServerOptions) {}

  get endpoint() {
    return this.endpointValue;
  }

  start(): Promise<MainAgentMcpEndpoint> {
    if (this.stopping) return this.stopping.then(() => this.start());
    if (this.endpointValue) return Promise.resolve(this.endpointValue);
    if (this.starting) return this.starting;
    this.starting = this.listen().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.close().finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }

  private async listen(): Promise<MainAgentMcpEndpoint> {
    const handler = createMcpHandler(({ requestInfo }) => {
      const scope =
        requestInfo && this.options.resolveScope
          ? this.options.resolveScope(requestInfo)
          : { tools: this.options.tools, access: "public" as const };
      return this.createProtocolServer(scope);
    });
    const nodeHandler = toNodeHandler(handler);
    const app = createMcpExpressApp({ host: MainMcpHost, allowedHosts: [MainMcpHost] });
    app.all(MainMcpProtocolPath, (request, response) =>
      nodeHandler(request, response, request.body)
    );
    const server = createServer(app);
    this.handler = handler;
    this.httpServer = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.options.port, MainMcpHost, () => {
          server.off("error", reject);
          resolve();
        });
      });
    } catch (error) {
      this.httpServer = undefined;
      this.handler = undefined;
      await handler.close();
      throw error;
    }
    const { port } = server.address() as AddressInfo;
    this.endpointValue = {
      host: MainMcpHost,
      port,
      url: `http://${MainMcpHost}:${port}${MainMcpProtocolPath}`
    };
    return this.endpointValue;
  }

  private createProtocolServer(scope: MainAgentMcpToolScope): McpServer {
    const server = new McpServer(
      { name: "airamusic-mcp-server", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    for (const tool of scope.tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.description.split(/\r?\n/, 1)[0]?.trim().slice(0, 80) || tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: {
            readOnlyHint: tool.risk === McpToolRisk.Read,
            destructiveHint: tool.risk === McpToolRisk.Destructive,
            idempotentHint: tool.risk === McpToolRisk.Read,
            openWorldHint: tool.openWorld
          }
        },
        async (input, sdkContext) => {
          const context: McpToolContext = {
            conversationID: "mcp",
            outputDetail: "standard",
            access: scope.access,
            signal: sdkContext.mcpReq.signal
          };
          try {
            await this.options.beforeCall?.(tool, context);
            const output = await tool.execute(input, context);
            return this.options.mapResult
              ? await this.options.mapResult(output, tool, context)
              : {
                  content: [
                    {
                      type: "text",
                      text: typeof output === "string" ? output : (JSON.stringify(output) ?? "")
                    }
                  ]
                };
          } catch (error) {
            if (this.options.mapError) return this.options.mapError(error, tool);
            throw error;
          }
        }
      );
    }
    return server;
  }

  private async close(): Promise<void> {
    await this.starting?.catch(() => undefined);
    const server = this.httpServer;
    const handler = this.handler;
    this.httpServer = undefined;
    this.handler = undefined;
    this.endpointValue = undefined;
    const closed = server?.listening
      ? new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
      : Promise.resolve();
    try {
      await handler?.close();
    } finally {
      // SDK 的旧协议兼容请求也必须释放底层 HTTP 连接。
      server?.closeAllConnections();
      await closed;
    }
  }
}
