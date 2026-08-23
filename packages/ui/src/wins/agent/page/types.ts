export type AgentToolCall = {
  name: string;
  callID: string;
  arguments: string;
};

export type AgentTokenUsage = {
  input?: number;
  total?: number;
  output?: number;
  requests?: number;
  lastInput?: number;
  reasoning?: number;
  cacheWrite?: number;
  cachedInput?: number;
};

export type AgentAssistantTurnObservability = {
  step: number;
  runID?: string;
  finishReason?: string;
  usage?: AgentTokenUsage;
  status: "complete" | "incomplete";
};

export type AgentRunTerminal = {
  id: string;
  error?: string;
  runID?: string;
  endedAt?: number;
  type: "terminal";
  startedAt?: number;
  usage?: AgentTokenUsage;
  status: "failed" | "aborted" | "max_steps";
};

export type AgentLiveToolResult = {
  name: string;
  callID: string;
  output: string;
};

export type AgentLiveReasoning = {
  id: string;
  step: number;
  text: string;
  runID?: string;
  type: "reasoning";
  messageID: string;
  status: "done" | "streaming";
};

export type AgentLiveTimelineItem =
  | AgentRunTerminal
  | AgentLiveReasoning
  | {
      id: string;
      text: string;
      runID?: string;
      type: "assistant";
    }
  | {
      id: string;
      step: number;
      type: "tool";
      runID?: string;
      toolCalls: AgentToolCall[];
      toolResults?: AgentLiveToolResult[];
      status: "done" | "error" | "running";
      assistantTurn?: AgentAssistantTurnObservability;
    };

export type AgentToolTimelineItem = {
  id: string;
  type: "tool";
  step?: number;
  runID?: string;
  toolCalls: AgentToolCall[];
  toolResults: AgentLiveToolResult[];
  status: "done" | "error" | "running";
  assistantTurn?: AgentAssistantTurnObservability;
};
