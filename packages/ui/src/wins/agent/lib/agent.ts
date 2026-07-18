import { RendererIPC } from "@mahiru/ipc/renderer";
import type { InvokeEventArgs } from "@mahiru/ipc/types";

export class RendererAgent {
  static listProvider() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_providers", undefined);
  }

  static listProviderDescriptors() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_provider_descriptors", undefined);
  }

  static listConfigs() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_configs", undefined);
  }

  static createConfig(config: InvokeEventArgs<"invoke_agent_create_config">) {
    return RendererIPC.NormalChannel.send("invoke_agent_create_config", config);
  }

  static updateConfig(config: InvokeEventArgs<"invoke_agent_update_config">) {
    return RendererIPC.NormalChannel.send("invoke_agent_update_config", config);
  }

  static createConversation(options: InvokeEventArgs<"invoke_agent_create_conversation">) {
    return RendererIPC.NormalChannel.send("invoke_agent_create_conversation", options);
  }

  static listConversations() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_conversations", undefined);
  }

  static listRuns() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_runs", undefined);
  }

  static getConversation(conversationID: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_get_conversation", conversationID);
  }

  static removeConversation(conversationID: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_remove_conversation", conversationID);
  }

  static chat(options: InvokeEventArgs<"invoke_agent_chat">) {
    return RendererIPC.NormalChannel.send("invoke_agent_chat", options);
  }

  static abort(runID: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_abort", runID);
  }
}
