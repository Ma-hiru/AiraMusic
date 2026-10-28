import { z } from "zod";
import { MainStoreForConfig } from "@/lib/key-value-store";
import type {
  AgentFeatureSettingsConfig,
  AgentFeatureSettingsUpdateInput
} from "@mahiru/ipc/types";

import { agentToolCatalog } from "./tools";

/** Agent 功能配置的校验、读取与持久化，不管理服务生命周期 */
export class MainAgentSettings {
  static readonly AgentFeatureDefaultMcpPort = 32_123;
  private static readonly AgentFeatureMaxMcpTools = 128;
  private static readonly AgentFeatureMaxToolNameChars = 128;
  private static readonly McpPortError = "mcpPort 必须是 1024 到 65535 之间的整数";
  private static readonly McpPortSchema = z
    .number({ error: this.McpPortError })
    .int({ error: this.McpPortError })
    .min(1_024, { error: this.McpPortError })
    .max(65_535, { error: this.McpPortError });
  private static readonly McpToolNameSchema = z
    .string({ error: "mcpTools 只能包含字符串" })
    .trim()
    .min(1, { error: `MCP 工具名必须是 1 到 ${this.AgentFeatureMaxToolNameChars} 个字符` })
    .max(this.AgentFeatureMaxToolNameChars, {
      error: `MCP 工具名必须是 1 到 ${this.AgentFeatureMaxToolNameChars} 个字符`
    })
    .superRefine((name, context) => {
      if (!agentToolCatalog.names.includes(name)) {
        context.addIssue({ code: "custom", message: `MCP 工具不在公开可选列表中：${name}` });
      }
    });
  private static readonly AgentFeatureSettingsUpdateSchema = z.strictObject(
    {
      agentEnabled: z.boolean({ error: "agentEnabled 必须是布尔值" }).optional(),
      mcpEnabled: z.boolean({ error: "mcpEnabled 必须是布尔值" }).optional(),
      mcpPort: this.McpPortSchema.optional(),
      mcpTools: z
        .array(this.McpToolNameSchema, {
          error: `mcpTools 必须是最多 ${this.AgentFeatureMaxMcpTools} 项的字符串数组`
        })
        .max(this.AgentFeatureMaxMcpTools, {
          error: `mcpTools 必须是最多 ${this.AgentFeatureMaxMcpTools} 项的字符串数组`
        })
        .refine((names) => new Set(names).size === names.length, {
          error: "mcpTools 不能包含重复工具"
        })
        .transform((names) => names.sort((left, right) => left.localeCompare(right)))
        .optional()
    },
    {
      error: (issue) =>
        issue.code === "unrecognized_keys"
          ? "Agent 功能设置包含不允许的字段"
          : "Agent 功能设置必须是对象"
    }
  );
  private static readonly DefaultAgentFeatureSettings: AgentFeatureSettingsConfig = {
    agentEnabled: true,
    mcpEnabled: false,
    mcpPort: this.AgentFeatureDefaultMcpPort,
    mcpTools: [...agentToolCatalog.defaultNames]
  };

  private static validateSettingsUpdate(input: unknown): AgentFeatureSettingsUpdateInput {
    const parsed = this.AgentFeatureSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
    const { mcpPort, mcpTools, mcpEnabled, agentEnabled } = parsed.data;
    return {
      ...(agentEnabled === undefined ? {} : { agentEnabled }),
      ...(mcpEnabled === undefined ? {} : { mcpEnabled }),
      ...(mcpPort === undefined ? {} : { mcpPort }),
      ...(mcpTools === undefined ? {} : { mcpTools })
    };
  }

  private static normalizeStoredToolNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [...this.DefaultAgentFeatureSettings.mcpTools].sort();
    const allowed = new Set(agentToolCatalog.names);
    const pruned = [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) =>
            item.trim() === "agent-tool-web-browser" ? "agent-tool-web-snapshot" : item.trim()
          )
          .filter((item) => item.length > 0 && item.length <= this.AgentFeatureMaxToolNameChars)
          .filter((item) => allowed.has(item))
      )
    ].sort();
    return pruned.length > 0
      ? pruned.slice(0, this.AgentFeatureMaxMcpTools)
      : [...this.DefaultAgentFeatureSettings.mcpTools].sort();
  }

  private static cloneSettings(settings: AgentFeatureSettingsConfig): AgentFeatureSettingsConfig {
    return { ...settings, mcpTools: [...settings.mcpTools] };
  }

  /** 启动时显式迁移旧配置并修复缺失或无效的存储值。 */
  static initialize(): AgentFeatureSettingsConfig {
    const settings = this.read();
    MainStoreForConfig.set(this.cloneSettings(settings));
    return settings;
  }

  static read(): AgentFeatureSettingsConfig {
    const agentEnabled = MainStoreForConfig.get("agentEnabled");
    const mcpEnabled = MainStoreForConfig.get("mcpEnabled");
    const mcpPort = this.McpPortSchema.safeParse(MainStoreForConfig.get("mcpPort"));
    return {
      agentEnabled:
        typeof agentEnabled === "boolean"
          ? agentEnabled
          : this.DefaultAgentFeatureSettings.agentEnabled,
      mcpEnabled:
        typeof mcpEnabled === "boolean" ? mcpEnabled : this.DefaultAgentFeatureSettings.mcpEnabled,
      mcpPort: mcpPort.success ? mcpPort.data : this.DefaultAgentFeatureSettings.mcpPort,
      mcpTools: this.normalizeStoredToolNames(MainStoreForConfig.get("mcpTools"))
    };
  }

  static update(input: AgentFeatureSettingsUpdateInput): AgentFeatureSettingsConfig {
    const update = this.validateSettingsUpdate(input);
    const next = { ...this.read(), ...update };
    if (next.mcpEnabled && next.mcpTools.length === 0) {
      throw new Error("开启 MCP 时至少需要选择一个公开工具");
    }
    if (next.mcpTools.length === 0)
      next.mcpTools = [...this.DefaultAgentFeatureSettings.mcpTools].sort();
    MainStoreForConfig.set(this.cloneSettings(next));
    return next;
  }
}
