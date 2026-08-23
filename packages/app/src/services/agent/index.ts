import { MainIPC } from "@mahiru/ipc/main";
import type { ProviderConfigInput } from "@mahiru/agent";
import type { AgentFeatureSettingsState } from "@mahiru/ipc/types";

import { RustAgentService } from "./child";
import { MainAgentFeatureSettings } from "./settings";

export class MainAgent {
  private static service?: RustAgentService;
  private static stopListening?: () => boolean;

  static isEnabled() {
    return MainAgentFeatureSettings.isAgentEffective();
  }

  static async init(mcpUrl: string): Promise<boolean> {
    if (this.service?.running) return true;
    if (!MainAgentFeatureSettings.beginAgentInitialization()) return false;

    const service = new RustAgentService();
    this.stopListening = service.listen((event) => {
      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "agent",
        type: "message_deliver_agent_chat_event",
        data: event
      });
    });
    try {
      await service.start(mcpUrl);
      this.service = service;
      MainAgentFeatureSettings.markAgentInitialized();
      return true;
    } catch (error) {
      this.stopListening?.();
      this.stopListening = undefined;
      await service.stop();
      MainAgentFeatureSettings.markAgentInitializationFailed();
      throw error;
    }
  }

  private static current() {
    if (!MainAgentFeatureSettings.isAgentEffective() || !this.service) {
      throw new Error("Agent 本次启动未运行；如已重新开启，请重启应用");
    }
    return this.service.current();
  }

  static async shutdown(): Promise<AgentFeatureSettingsState> {
    const service = this.service;
    this.service = undefined;
    this.stopListening?.();
    this.stopListening = undefined;
    if (service) await service.stop();
    return MainAgentFeatureSettings.markAgentStopped();
  }

  static broadcastFeatureSettings(
    state: AgentFeatureSettingsState = MainAgentFeatureSettings.getState()
  ) {
    MainIPC.MessageChannel.commitAll({
      sender: "process",
      type: "message_deliver_agent_feature_settings",
      data: state
    });
  }

  static listProviders() {
    return this.current().listProviders();
  }

  static listConfigs() {
    return this.current().listConfigs();
  }

  static async createConfig(input: ProviderConfigInput) {
    const configs = await this.current().listConfigs();
    return this.current().createConfig({
      ...input,
      id: undefined,
      default: configs.length === 0 ? true : input.default
    });
  }

  static updateConfig(id: string, input: ProviderConfigInput) {
    return this.current().updateConfig(id, { ...input, id });
  }

  static createThread(input: { name?: string } = {}) {
    return this.current().createThread(input);
  }

  static listThreads() {
    return this.current().listThreads();
  }

  static listRuns() {
    return this.current().listRuns();
  }

  static getThread(id: string) {
    return this.current().getThread(id);
  }

  static deleteThread(id: string) {
    return this.current().deleteThread(id);
  }

  static async createRun(threadId: string, configId: string, content: string) {
    await this.current().setThreadConfig(threadId, configId);
    return this.current().createRun(threadId, content);
  }

  static cancelRun(runId: string) {
    return this.current().cancelRun(runId);
  }
}
