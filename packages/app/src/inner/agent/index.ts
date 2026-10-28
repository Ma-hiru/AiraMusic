import { Log } from "@/lib/log";
import { MainWindowManager } from "@/lib/window-manager";
import type AgentService from "@/services/agent";
import type { MainServicesBase } from "@/lib/service";
import type {
  AgentConnection,
  AgentFeatureSettingsState,
  AgentFeatureSettingsConfig,
  AgentFeatureSettingsUpdateInput
} from "@mahiru/ipc/types";

import { MainAgentMcp } from "./mcp";
import { agentToolCatalog } from "./tools";
import { MainAgentSettings } from "./settings";

export interface MainAgentOptions {
  onStateChange?(state: AgentFeatureSettingsState): void;
}

/** 应用 Agent 功能入口；进程与 HTTP 生命周期仍由各自实例管理。 */
export class MainAgent {
  private readonly startup: AgentFeatureSettingsConfig;
  private services?: MainServicesBase;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;
  private updating: Promise<void> = Promise.resolve();

  constructor(private readonly options: MainAgentOptions = {}) {
    this.startup = MainAgentSettings.initialize();
  }

  private get service(): undefined | AgentService {
    return (this.services?.getInstance("agent") ?? undefined) as undefined | AgentService;
  }

  get running(): boolean {
    return this.service?.running ?? false;
  }

  /** 本轮只执行一次；设置更新与连接查询都不会重新启动功能。 */
  init(services: MainServicesBase): Promise<void> {
    if (this.starting) return this.starting;
    if (this.stopping) return this.stopping;
    this.services = services;
    this.starting = this.start().finally(() => this.notify());
    return this.starting;
  }

  getConnection(): AgentConnection {
    if (!this.running) throw new Error("Agent 本次启动未运行；请重启应用");
    return this.service!.getConnection();
  }

  getState(): AgentFeatureSettingsState {
    const desired = MainAgentSettings.read();
    const applied = MainAgentMcp.appliedConfig ?? this.startup;
    const endpoint = MainAgentMcp.endpoint;
    const effective: AgentFeatureSettingsConfig = {
      agentEnabled: this.running,
      mcpEnabled: Boolean(endpoint && applied.mcpEnabled),
      mcpPort: endpoint?.port ?? this.startup.mcpPort,
      mcpTools: [...applied.mcpTools]
    };
    const mcpChanged =
      desired.mcpPort !== effective.mcpPort ||
      desired.mcpTools.length !== effective.mcpTools.length ||
      desired.mcpTools.some((name, index) => name !== effective.mcpTools[index]);
    return {
      ...desired,
      effective,
      restartRequired:
        desired.agentEnabled !== effective.agentEnabled ||
        desired.mcpEnabled !== effective.mcpEnabled ||
        ((desired.mcpEnabled || effective.mcpEnabled) && mcpChanged),
      availableMcpTools: agentToolCatalog.resolve(agentToolCatalog.names).map((tool) => {
        const description = tool.description.trim() || `AiraMusic 公开工具：${tool.name}`;
        const label = description.split(/[，。；;\n]/, 1)[0]?.trim() || tool.name;
        return {
          name: tool.name,
          description,
          risk: tool.risk,
          label: label.length > 24 ? `${label.slice(0, 23)}…` : label
        };
      })
    };
  }

  updateSettings(input: AgentFeatureSettingsUpdateInput): Promise<AgentFeatureSettingsState> {
    const operation = this.updating.then(async () => {
      const config = MainAgentSettings.update(input);
      await this.starting;
      try {
        // 按当前期望值停止；上次停止失败时，同样的设置也能再次尝试。
        if (!config.agentEnabled) {
          this.closeWindow();
          await this.services?.stopService("agent");
        }
        if (!config.agentEnabled && !config.mcpEnabled) await MainAgentMcp.shutdown();
        return this.getState();
      } finally {
        this.notify();
      }
    });
    this.updating = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  shutdown(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.stop().catch((error: unknown) => {
      this.stopping = undefined;
      throw error;
    });
    return this.stopping;
  }

  private async start(): Promise<void> {
    const desired = MainAgentSettings.read();
    if (
      !(this.startup.agentEnabled && desired.agentEnabled) &&
      !(this.startup.mcpEnabled && desired.mcpEnabled)
    )
      return;
    try {
      const endpoint = await MainAgentMcp.init(this.startup);
      if (!endpoint) return;
      Log.info("mcp", `MCP listening at ${endpoint.url}`);
    } catch (error) {
      Log.warn("mcp", "failed to enable MCP", error);
      return;
    }
    if (this.stopping || !this.startup.agentEnabled || !MainAgentSettings.read().agentEnabled)
      return;
    try {
      await this.services!.startService("agent");
    } catch (error) {
      Log.warn("agent", "failed to enable agent", error);
    }
  }

  private async stop(): Promise<void> {
    await this.updating;
    await this.starting?.catch(() => undefined);
    this.closeWindow();
    try {
      await this.services?.stopService("agent");
    } finally {
      await MainAgentMcp.shutdown();
      this.notify();
    }
  }

  private closeWindow() {
    const window = MainWindowManager.get("agent");
    try {
      if (window && !window.isDestroyed()) window.destroy();
    } catch (error) {
      Log.warn("agent", "failed to destroy agent window", error);
    } finally {
      MainWindowManager.remove("agent");
    }
  }

  private notify() {
    this.options.onStateChange?.(this.getState());
  }
}
