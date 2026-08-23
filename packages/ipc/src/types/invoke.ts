import type {
  RunAccepted,
  ThreadSummary,
  ThreadSnapshot,
  ProviderConfigView,
  ProviderDescriptor,
  ProviderConfigInput
} from "@mahiru/agent";

import type { AgentInvokeResult } from "./agent";

export type AgentCreateRunInput = {
  content: string;
  configId: string;
  threadId: string;
};

export type AgentProviderConfigUpdateInput = {
  id: string;
  config: ProviderConfigInput;
};

export type AgentFeatureSettingsConfig = {
  mcpPort: number;
  mcpTools: string[];
  mcpEnabled: boolean;
  agentEnabled: boolean;
};

export type AgentFeatureSettingsMcpTool = {
  name: string;
  label: string;
  description: string;
  risk: "read" | "write" | "destructive";
};

export type AgentFeatureSettingsState = AgentFeatureSettingsConfig & {
  /** 本次应用启动后实际采用的配置；它不会因仅持久化设置而偷偷热启服务。 */
  restartRequired: boolean;
  effective: AgentFeatureSettingsConfig;
  availableMcpTools: AgentFeatureSettingsMcpTool[];
};

export type AgentFeatureSettingsUpdateInput = Partial<AgentFeatureSettingsConfig>;

/** Invoke 事件类型以及参数 */
export type InvokeEventMaps = {
  invoke_runtime_id: [undefined, string];
  invoke_runtime_token: [undefined, string];
  invoke_window_id: [undefined, WindowType];
  invoke_window_opened: [WindowType, boolean];
  invoke_window_pinned: [WindowType, boolean];
  invoke_window_maximized: [WindowType, boolean];
  invoke_window_fullscreen: [WindowType, boolean];
  invoke_device_gpu: [undefined, Promise<unknown>];
  invoke_device_platform: [undefined, NodeJS.Platform];
  invoke_device_net: [undefined, Promise<NetworkStatus>];
  invoke_cache_config_get: [undefined, { ttl: string; path: string; capacity: number }];
  invoke_store_get: [string, { ok: false; reason?: string } | { ok: true; value: JsonValue }];
  invoke_store_set: [
    { key: string; value: JsonValue },
    { ok: true } | { ok: false; reason?: string }
  ];
  invoke_fs_select: [
    type: "dir" | "file",
    Promise<{ ok: boolean; path: string; error?: string; canceled?: boolean }>
  ];
  invoke_fs_save: [
    { name: string; buffer: ArrayBuffer },
    Promise<{ ok: boolean; error?: string; canceled?: boolean }>
  ];
  invoke_window_bounds: [
    undefined,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      workAreaWidth: number;
      workAreaHeight: number;
    }
  ];
  invoke_cache_config_update: [
    { ttl?: string; path?: string; capacity?: number },
    (
      | { ok: false; reason: string }
      | { ok: true; config: { ttl: string; path: string; capacity: number } }
    )
  ];
  // agent
  invoke_agent_cancel_run: [string, Promise<AgentInvokeResult<void>>];
  invoke_agent_delete_thread: [string, Promise<AgentInvokeResult<void>>];
  invoke_store_delete: [string, { ok: true } | { ok: false; reason?: string }];
  invoke_agent_get_thread: [string, Promise<AgentInvokeResult<ThreadSnapshot>>];
  invoke_agent_list_runs: [undefined, Promise<AgentInvokeResult<RunAccepted[]>>];
  invoke_agent_list_threads: [undefined, Promise<AgentInvokeResult<ThreadSummary[]>>];
  invoke_agent_create_run: [AgentCreateRunInput, Promise<AgentInvokeResult<RunAccepted>>];
  invoke_agent_list_configs: [undefined, Promise<AgentInvokeResult<ProviderConfigView[]>>];
  invoke_agent_list_providers: [undefined, Promise<AgentInvokeResult<ProviderDescriptor[]>>];
  invoke_agent_feature_settings_get: [undefined, AgentInvokeResult<AgentFeatureSettingsState>];
  invoke_agent_create_config: [ProviderConfigInput, Promise<AgentInvokeResult<ProviderConfigView>>];
  invoke_agent_create_thread: [
    undefined | { name?: string },
    Promise<AgentInvokeResult<ThreadSummary>>
  ];
  invoke_agent_update_config: [
    AgentProviderConfigUpdateInput,
    Promise<AgentInvokeResult<ProviderConfigView>>
  ];
  invoke_agent_feature_settings_update: [
    AgentFeatureSettingsUpdateInput,
    Promise<AgentInvokeResult<AgentFeatureSettingsState>>
  ];
};

/** Invoke 事件类型 */
export type InvokeEvent = keyof InvokeEventMaps;

/** Invoke 事件参数类型 */
export type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

/** Invoke 事件负载类型 */
export type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];
