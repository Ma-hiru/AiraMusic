import type { AgentAssistantTurnObservability } from "@/wins/agent/lib/chat/interface";

export type AgentToolCall = {
  name: string;
  callID: string;
  arguments: string;
};

export type AgentToolResult = {
  name: string;
  callID: string;
  output: string;
};

export type AgentToolTimelineItem = {
  id: string;
  type: "tool";
  step?: number;
  runID?: string;
  toolCalls: AgentToolCall[];
  toolResults: AgentToolResult[];
  status: "done" | "error" | "running";
  assistantTurn?: AgentAssistantTurnObservability;
};
