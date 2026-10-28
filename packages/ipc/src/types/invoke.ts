import type { AgentInvokeResult } from "./agent";
import type { NetFetchRequest, NetFetchResponse } from "./net";

export type AgentConnection = { token: string; endpoint: string };

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
  // runtime
  invoke_runtime_id: [undefined, string];
  invoke_runtime_token: [undefined, string];
  // window
  invoke_window_id: [undefined, WindowType];
  invoke_window_shown: [WindowType, boolean];
  invoke_window_opened: [WindowType, boolean];
  invoke_window_pinned: [WindowType, boolean];
  invoke_window_maximized: [WindowType, boolean];
  invoke_window_fullscreen: [WindowType, boolean];
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
  // device
  invoke_device_gpu: [undefined, Promise<unknown>];
  invoke_device_platform: [undefined, NodeJS.Platform];
  invoke_device_net: [undefined, Promise<NetworkStatus>];
  invoke_net_fetch: [NetFetchRequest, Promise<NetFetchResponse>];
  // store
  invoke_store_delete: [string, { ok: true } | { ok: false; reason?: string }];
  invoke_store_get: [string, { ok: false; reason?: string } | { ok: true; value: JsonValue }];
  invoke_store_set: [
    { key: string; value: JsonValue },
    { ok: true } | { ok: false; reason?: string }
  ];
  // log
  invoke_log_export: [
    scope: "all" | "recent",
    Promise<{ ok: boolean; error?: string; canceled?: boolean }>
  ];
  // fs
  invoke_fs_select: [
    type: "dir" | "file",
    Promise<{ ok: boolean; path: string; error?: string; canceled?: boolean }>
  ];
  invoke_fs_save: [
    { name: string; buffer: ArrayBuffer },
    Promise<{ ok: boolean; error?: string; canceled?: boolean }>
  ];
  // go cache
  invoke_cache_config_get: [undefined, { ttl: string; path: string; capacity: number }];
  invoke_cache_config_update: [
    { ttl?: string; path?: string; capacity?: number },
    (
      | { ok: false; reason: string }
      | { ok: true; config: { ttl: string; path: string; capacity: number } }
    )
  ];
  // agent
  invoke_agent_connection: [undefined, Promise<AgentInvokeResult<AgentConnection>>];
  invoke_agent_feature_settings_get: [undefined, AgentInvokeResult<AgentFeatureSettingsState>];
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
