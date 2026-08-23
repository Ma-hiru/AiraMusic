import { RendererIPC } from "@mahiru/ipc/renderer";
import type { InvokeEventArgs } from "@mahiru/ipc/types";

export class RendererAgent {
  static listProviders() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_providers", undefined);
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

  static createThread(options: InvokeEventArgs<"invoke_agent_create_thread">) {
    return RendererIPC.NormalChannel.send("invoke_agent_create_thread", options);
  }

  static listThreads() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_threads", undefined);
  }

  static listRuns() {
    return RendererIPC.NormalChannel.send("invoke_agent_list_runs", undefined);
  }

  static getThread(threadId: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_get_thread", threadId);
  }

  static deleteThread(threadId: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_delete_thread", threadId);
  }

  static createRun(input: InvokeEventArgs<"invoke_agent_create_run">) {
    return RendererIPC.NormalChannel.send("invoke_agent_create_run", input);
  }

  static cancelRun(runId: string) {
    return RendererIPC.NormalChannel.send("invoke_agent_cancel_run", runId);
  }
}
