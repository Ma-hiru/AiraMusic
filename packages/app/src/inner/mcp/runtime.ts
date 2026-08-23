import { AiraMcpServer, type AiraMcpEndpoint } from "./server";
import { MainRuntime } from "@/lib/runtime";
import { MainAgentFeatureSettings } from "@/services/agent/settings";
import { AiraPublicMcpToolNames } from "./public-tools";

/** 管理应用进程中唯一的本地 MCP 实例。 */
export class MainMcp {
  private static server?: AiraMcpServer;
  private static starting?: Promise<undefined | AiraMcpEndpoint>;

  static init(): Promise<undefined | AiraMcpEndpoint> {
    if (this.server?.endpoint) return Promise.resolve(this.server.endpoint);
    if (this.starting) return this.starting;

    const config = MainAgentFeatureSettings.beginMcpInitialization();
    if (!config) return Promise.resolve(undefined);

    const server = new AiraMcpServer({
      port: config.mcpPort,
      toolNames: config.mcpEnabled ? config.mcpTools : [],
      internalToken: MainRuntime.agentMcpToken,
      internalToolNames: AiraPublicMcpToolNames
    });
    this.server = server;
    this.starting = server
      .start()
      .then((endpoint) => {
        if (config.mcpEnabled) {
          MainAgentFeatureSettings.markMcpInitialized(endpoint.port, config.mcpTools);
        }
        return endpoint;
      })
      .catch(async (error: unknown) => {
        // 回收失败不能覆盖真正的启动错误，也不能阻止运行状态复位。
        await Promise.allSettled([server.stop()]);
        if (this.server === server) this.server = undefined;
        MainAgentFeatureSettings.markMcpInitializationFailed();
        throw error;
      })
      .finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }

  static async shutdown(): Promise<void> {
    const starting = this.starting;
    if (starting) {
      try {
        await starting;
      } catch {
        // 启动失败时已在 init 分支中回收。
      }
    }

    const server = this.server;
    this.server = undefined;
    try {
      if (server) await server.stop();
    } finally {
      MainAgentFeatureSettings.markMcpStopped();
    }
  }
}
