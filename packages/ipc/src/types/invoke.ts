import type {
  AIAgentChatOptions,
  AIAgentChatAccepted,
  LLMConversationSnapshot,
  LLMProviderOpenAIConfig,
  AIProviderConfigSnapshot,
  AIAgentCreateConfigOptions,
  LLMConversationCreateOptions,
  AIAgentCreateConversationResult
} from "@mahiru/ai";

import type { AgentInvokeResult, AgentConversationSummary } from "./agent";

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
  invoke_agent_abort: [string, Promise<AgentInvokeResult<void>>];
  invoke_agent_list_providers: [undefined, AgentInvokeResult<string[]>];
  invoke_agent_remove_conversation: [string, Promise<AgentInvokeResult<void>>];
  invoke_store_delete: [string, { ok: true } | { ok: false; reason?: string }];
  invoke_agent_chat: [AIAgentChatOptions, Promise<AgentInvokeResult<AIAgentChatAccepted>>];
  invoke_agent_list_configs: [undefined, Promise<AgentInvokeResult<AIProviderConfigSnapshot[]>>];
  invoke_agent_list_conversations: [
    undefined,
    Promise<AgentInvokeResult<AgentConversationSummary[]>>
  ];
  invoke_agent_get_conversation: [
    string,
    Promise<AgentInvokeResult<Optional<LLMConversationSnapshot>>>
  ];
  invoke_agent_create_config: [
    AIAgentCreateConfigOptions<LLMProviderOpenAIConfig>,
    Promise<AgentInvokeResult<AIProviderConfigSnapshot>>
  ];
  invoke_agent_create_conversation: [
    undefined | Partial<LLMConversationCreateOptions>,
    Promise<AgentInvokeResult<AIAgentCreateConversationResult>>
  ];
};

/** Invoke 事件类型 */
export type InvokeEvent = keyof InvokeEventMaps;

/** Invoke 事件参数类型 */
export type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

/** Invoke 事件负载类型 */
export type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];
