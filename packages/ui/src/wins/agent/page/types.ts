import type { LLMToolCall } from "@mahiru/ai";

export type AgentLiveToolResult = {
  name: string;
  callID: string;
  output: string;
};

export type AgentLiveTimelineItem =
  | {
      id: string;
      text: string;
      type: "assistant";
    }
  | {
      id: string;
      step: number;
      type: "tool";
      toolCalls: LLMToolCall[];
      toolResults?: AgentLiveToolResult[];
      status: "done" | "error" | "running";
    };

export type AgentToolTimelineItem = {
  id: string;
  type: "tool";
  step?: number;
  toolCalls: LLMToolCall[];
  toolResults: AgentLiveToolResult[];
  status: "done" | "error" | "running";
};
