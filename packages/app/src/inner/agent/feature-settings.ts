import { AIError } from "@mahiru/ai";
import { MainStoreForConfig } from "@/lib/key-value-store";
import type {
  AgentFeatureSettingsState,
  AgentFeatureSettingsConfig,
  AgentFeatureSettingsMcpTool,
  AgentFeatureSettingsUpdateInput
} from "@mahiru/ipc/types";

import { createAgentToolCatalog } from "./tool-catalog";
import { AiraPublicMcpToolNames, AiraDefaultMcpToolNames } from "../mcp/public-tools";

export const AgentFeatureDefaultMcpPort = 32_123;

const AgentFeatureMaxMcpTools = 128;
const AgentFeatureMaxToolNameChars = 128;
const AgentFeatureSettingsKeys = ["agentEnabled", "mcpEnabled", "mcpPort", "mcpTools"] as const;

const DefaultAgentFeatureSettings: AgentFeatureSettingsConfig = {
  agentEnabled: true,
  mcpEnabled: false,
  mcpPort: AgentFeatureDefaultMcpPort,
  // 默认可选全集里的无副作用子集；控制类/破坏性工具需在设置里显式勾选。
  mcpTools: [...AiraDefaultMcpToolNames]
};

let availableMcpToolsCache: undefined | AgentFeatureSettingsMcpTool[];

/**
 * 管理 Agent 与 MCP 的持久设置和本次启动快照。
 * 设置更新只改变期望值；是否真正运行由 effective 明确表达。
 */
export class MainAgentFeatureSettings {
  private static startup?: AgentFeatureSettingsConfig;
  private static effective?: AgentFeatureSettingsConfig;
  private static agentInitializationAttempted = false;
  private static agentStoppedThisSession = false;
  private static mcpInitializationAttempted = false;

  /** 在应用启动阶段冻结一次配置，后续更新不能借机热启 Agent 或 MCP。 */
  static captureStartup(): AgentFeatureSettingsState {
    if (!this.startup || !this.effective) {
      const startup = readStoredSettings();
      this.startup = cloneSettings(startup);
      this.effective = {
        ...cloneSettings(startup),
        // Agent 只有实例创建成功后才算真正启用。
        agentEnabled: false,
        // MCP 只有真正完成端口监听后才算本次启动已启用。
        mcpEnabled: false
      };
    }
    return this.getState();
  }

  /** 只允许启动流程尝试一次初始化，关闭后不能在本轮再次懒初始化。 */
  static beginAgentInitialization(): boolean {
    this.ensureCaptured();
    const desired = readStoredSettings();
    if (
      this.agentInitializationAttempted ||
      this.agentStoppedThisSession ||
      !this.startup?.agentEnabled ||
      !desired.agentEnabled
    ) {
      return false;
    }
    this.agentInitializationAttempted = true;
    return true;
  }

  static isAgentRequestedAtStartup(): boolean {
    this.ensureCaptured();
    return Boolean(this.startup?.agentEnabled && readStoredSettings().agentEnabled);
  }

  static markAgentInitialized(): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.effective!.agentEnabled = true;
    return this.getState();
  }

  static markAgentInitializationFailed(): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.effective!.agentEnabled = false;
    return this.getState();
  }

  static markAgentStopped(): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.agentInitializationAttempted = true;
    this.agentStoppedThisSession = true;
    this.effective!.agentEnabled = false;
    return this.getState();
  }

  static isAgentEffective(): boolean {
    this.ensureCaptured();
    return this.effective!.agentEnabled;
  }

  /**
   * 返回本次进程用于启动 MCP 的配置，并防止重复启动。
   * 开关以启动快照为准（中途打开不能热启）；工具列表/端口读取最新持久化值。
   */
  static beginMcpInitialization(): undefined | AgentFeatureSettingsConfig {
    this.ensureCaptured();
    if (this.mcpInitializationAttempted || !this.startup?.mcpEnabled) return undefined;
    this.mcpInitializationAttempted = true;
    const desired = readStoredSettings();
    return cloneSettings({
      ...this.startup,
      mcpPort: desired.mcpPort,
      mcpTools: desired.mcpTools
    });
  }

  static markMcpInitialized(
    port: number,
    toolNames?: readonly string[]
  ): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.effective!.mcpEnabled = true;
    this.effective!.mcpPort = port;
    if (toolNames) this.effective!.mcpTools = [...toolNames];
    return this.getState();
  }

  static markMcpInitializationFailed(): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.effective!.mcpEnabled = false;
    return this.getState();
  }

  static markMcpStopped(): AgentFeatureSettingsState {
    this.ensureCaptured();
    this.effective!.mcpEnabled = false;
    return this.getState();
  }

  static update(input: AgentFeatureSettingsUpdateInput): AgentFeatureSettingsState {
    const update = validateSettingsUpdate(input);
    const next = { ...readStoredSettings(), ...update };
    if (update.mcpTools) next.mcpTools = [...update.mcpTools];
    if (next.mcpEnabled && next.mcpTools.length === 0) {
      throw invalidSettings("开启 MCP 时至少需要选择一个公开工具");
    }

    MainStoreForConfig.set({
      agentEnabled: next.agentEnabled,
      mcpEnabled: next.mcpEnabled,
      mcpPort: next.mcpPort,
      mcpTools: next.mcpTools
    });
    return this.getState();
  }

  static getState(): AgentFeatureSettingsState {
    this.ensureCaptured();
    const desired = readStoredSettings();
    const effective = cloneSettings(this.effective!);
    const mcpConfigurationChanged =
      desired.mcpPort !== effective.mcpPort ||
      !sameStringArray(desired.mcpTools, effective.mcpTools);
    const restartRequired =
      desired.agentEnabled !== effective.agentEnabled ||
      desired.mcpEnabled !== effective.mcpEnabled ||
      ((desired.mcpEnabled || effective.mcpEnabled) && mcpConfigurationChanged);

    return {
      ...cloneSettings(desired),
      effective,
      availableMcpTools: listAvailableMcpTools(),
      restartRequired
    };
  }

  private static ensureCaptured() {
    if (!this.startup || !this.effective) this.captureStartup();
  }
}

function readStoredSettings(): AgentFeatureSettingsConfig {
  const storedAgentEnabled = MainStoreForConfig.get("agentEnabled");
  const legacyAgentEnabled = MainStoreForConfig.get("enableAgent");
  const agentEnabled =
    typeof storedAgentEnabled === "boolean"
      ? storedAgentEnabled
      : typeof legacyAgentEnabled === "boolean"
        ? legacyAgentEnabled
        : DefaultAgentFeatureSettings.agentEnabled;
  if (typeof storedAgentEnabled !== "boolean") {
    MainStoreForConfig.set("agentEnabled", agentEnabled);
  }

  const storedMcpEnabled = MainStoreForConfig.get("mcpEnabled");
  const storedMcpPort = MainStoreForConfig.get("mcpPort");
  const storedMcpTools = MainStoreForConfig.get("mcpTools");
  const mcpTools = normalizeStoredToolNames(storedMcpTools);
  if (Array.isArray(storedMcpTools)) {
    const storedNormalized = [
      ...new Set(
        storedMcpTools
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ].sort((left, right) => left.localeCompare(right));
    if (!sameStringArray(mcpTools, storedNormalized)) {
      MainStoreForConfig.set("mcpTools", mcpTools);
    }
  }
  return {
    agentEnabled,
    mcpEnabled:
      typeof storedMcpEnabled === "boolean"
        ? storedMcpEnabled
        : DefaultAgentFeatureSettings.mcpEnabled,
    mcpPort: isValidMcpPort(storedMcpPort) ? storedMcpPort : DefaultAgentFeatureSettings.mcpPort,
    mcpTools
  };
}

function validateSettingsUpdate(input: unknown): AgentFeatureSettingsUpdateInput {
  if (!isRecord(input)) throw invalidSettings("Agent 功能设置必须是对象");
  const allowed = new Set<string>(AgentFeatureSettingsKeys);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw invalidSettings("Agent 功能设置包含不允许的字段");
  }
  if (input["agentEnabled"] !== undefined && typeof input["agentEnabled"] !== "boolean") {
    throw invalidSettings("agentEnabled 必须是布尔值");
  }
  if (input["mcpEnabled"] !== undefined && typeof input["mcpEnabled"] !== "boolean") {
    throw invalidSettings("mcpEnabled 必须是布尔值");
  }
  if (input["mcpPort"] !== undefined && !isValidMcpPort(input["mcpPort"])) {
    throw invalidSettings("mcpPort 必须是 1024 到 65535 之间的整数");
  }

  const mcpTools =
    input["mcpTools"] === undefined ? undefined : validateAndNormalizeToolNames(input["mcpTools"]);
  return {
    ...(input["agentEnabled"] === undefined ? {} : { agentEnabled: input["agentEnabled"] }),
    ...(input["mcpEnabled"] === undefined ? {} : { mcpEnabled: input["mcpEnabled"] }),
    ...(input["mcpPort"] === undefined ? {} : { mcpPort: input["mcpPort"] }),
    ...(mcpTools === undefined ? {} : { mcpTools })
  };
}

function validateAndNormalizeToolNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > AgentFeatureMaxMcpTools) {
    throw invalidSettings(`mcpTools 必须是最多 ${AgentFeatureMaxMcpTools} 项的字符串数组`);
  }
  const names = value.map((name) => {
    if (typeof name !== "string") throw invalidSettings("mcpTools 只能包含字符串");
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > AgentFeatureMaxToolNameChars) {
      throw invalidSettings(`MCP 工具名必须是 1 到 ${AgentFeatureMaxToolNameChars} 个字符`);
    }
    if (!(AiraPublicMcpToolNames as readonly string[]).includes(trimmed)) {
      throw invalidSettings(`MCP 工具不在公开可选列表中：${trimmed}`);
    }
    return trimmed;
  });
  if (new Set(names).size !== names.length) throw invalidSettings("mcpTools 不能包含重复工具");
  return names.sort((left, right) => left.localeCompare(right));
}

function normalizeStoredToolNames(value: unknown): string[] {
  if (value === undefined) return [...DefaultAgentFeatureSettings.mcpTools].sort();
  if (!Array.isArray(value)) return [...DefaultAgentFeatureSettings.mcpTools].sort();

  // 旧配置可能含播放控制/破坏性工具；启动时静默裁剪，避免 MCP 因幽灵工具名整体起不来。
  const allowed = new Set<string>(AiraPublicMcpToolNames);
  const pruned = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= AgentFeatureMaxToolNameChars)
        .filter((item) => allowed.has(item))
    )
  ].sort();
  if (pruned.length === 0) return [...DefaultAgentFeatureSettings.mcpTools].sort();
  if (pruned.length > AgentFeatureMaxMcpTools) {
    return pruned.slice(0, AgentFeatureMaxMcpTools);
  }
  return pruned;
}

function isValidMcpPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1_024 && Number(value) <= 65_535;
}

function cloneSettings(settings: AgentFeatureSettingsConfig): AgentFeatureSettingsConfig {
  return { ...settings, mcpTools: [...settings.mcpTools] };
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function listAvailableMcpTools(): AgentFeatureSettingsMcpTool[] {
  if (!availableMcpToolsCache) {
    // MCP 白名单可含破坏性工具，设置页需按完整目录展示可选项。
    const toolByName = new Map(createAgentToolCatalog(true).list.map((tool) => [tool.name, tool]));
    availableMcpToolsCache = AiraPublicMcpToolNames.flatMap((name) => {
      const tool = toolByName.get(name);
      // 白名单与工具目录不一致时不展示幽灵项，避免勾选后启动失败。
      if (!tool) return [];
      const description = tool.description.trim() || `AiraMusic 公开工具：${name}`;
      return [
        {
          name,
          label: createToolLabel(description, name),
          description
        }
      ];
    });
  }
  return availableMcpToolsCache.map((tool) => ({ ...tool }));
}

function createToolLabel(description: string, fallback: string): string {
  const firstClause = description.split(/[，。；;\n]/, 1)[0]?.trim();
  if (!firstClause) return fallback;
  return firstClause.length > 24 ? `${firstClause.slice(0, 23)}…` : firstClause;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidSettings(message: string) {
  return new AIError({ type: "invalid_config", message });
}
