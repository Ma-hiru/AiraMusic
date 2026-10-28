import { createHash, timingSafeEqual } from "node:crypto";
import { MainRuntime } from "@/lib/runtime";
import { MainAgentTool } from "@/lib/agent/tool";
import { MainWindowManager } from "@/lib/window-manager";
import { MainAgentMcpServer, type MainAgentMcpEndpoint } from "@/lib/agent/server";
import type { AgentFeatureSettingsConfig } from "@mahiru/ipc/types";

import { agentToolCatalog } from "./tools";

/** 管理应用进程中唯一的本地 MCP 实例 */
export class MainAgentMcp {
  private static server?: MainAgentMcpServer;
  private static starting?: Promise<Undefinable<MainAgentMcpEndpoint>>;
  private static stopping?: Promise<void>;
  private static applied?: AgentFeatureSettingsConfig;

  static get endpoint() {
    return this.server?.endpoint;
  }

  static get appliedConfig(): undefined | Readonly<AgentFeatureSettingsConfig> {
    return this.applied && { ...this.applied, mcpTools: [...this.applied.mcpTools] };
  }

  static init(config: AgentFeatureSettingsConfig): Promise<undefined | MainAgentMcpEndpoint> {
    if (!config.agentEnabled && !config.mcpEnabled) return Promise.resolve(undefined);
    const snapshot = { ...config, mcpTools: [...config.mcpTools] };
    if (this.stopping) return this.stopping.then(() => this.init(snapshot));
    if (this.starting) return this.starting;
    if (this.server?.endpoint) return Promise.resolve(this.server.endpoint);

    const publicTools = agentToolCatalog.resolve(snapshot.mcpEnabled ? snapshot.mcpTools : []);
    const internalToken = createHash("sha256").update(MainRuntime.agentMcpToken).digest();
    const server = new MainAgentMcpServer({
      port: snapshot.mcpPort,
      tools: publicTools,
      resolveScope: (request) => {
        const authorization = request.headers.get("authorization");
        const internal =
          authorization?.startsWith("Bearer ") &&
          timingSafeEqual(
            createHash("sha256").update(authorization.slice(7)).digest(),
            internalToken
          );
        return internal
          ? { tools: agentToolCatalog.list, access: "internal" }
          : { tools: publicTools, access: "public" };
      },
      beforeCall: (tool, context) =>
        MainAgentTool.beforeCall(tool, context, () => MainWindowManager.get("main") !== null),
      mapResult: (output, tool, context) => MainAgentTool.formatResult(output, tool, context),
      mapError: (error, tool) => MainAgentTool.formatError(error, tool)
    });
    this.server = server;
    this.starting = server
      .start()
      .then((endpoint) => {
        this.applied = snapshot;
        return endpoint;
      })
      .catch(async (error: unknown) => {
        // 回收失败不能覆盖真正的启动错误，也不能阻止运行状态复位。
        await Promise.allSettled([server.stop()]);
        if (this.server === server) this.server = undefined;
        this.applied = undefined;
        throw error;
      })
      .finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }

  static shutdown(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.stop().finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }

  private static async stop(): Promise<void> {
    // 等待正在建立的监听器，避免它在 shutdown 返回后才开始监听。
    await this.starting?.catch(() => undefined);
    const server = this.server;
    if (server) await server.stop();
    if (this.server === server) {
      this.server = undefined;
      this.applied = undefined;
    }
  }
}
