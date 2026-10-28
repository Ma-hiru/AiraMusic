import { MainIPC } from "@mahiru/ipc/main";
import type { AgentFeatureSettingsState } from "@mahiru/ipc/types";

export function broadcastAgentFeatureSettings(state: AgentFeatureSettingsState) {
  MainIPC.MessageChannel.commitAll({
    sender: "process",
    type: "message_deliver_agent_feature_settings",
    data: state
  });
}
