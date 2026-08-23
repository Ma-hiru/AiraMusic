import type { AGUIEvent, ThreadSnapshot } from "@mahiru/agent/browser";
import type { AgentToolCall, AgentTokenUsage, AgentLiveToolResult } from "@/wins/agent/page/types";

export type AgentConversationEvent =
  | { type: "started"; runID: string; conversationID: string }
  | { type: "text_delta"; runID: string; conversationID: string; step: number; text: string }
  | {
      type: "reasoning_started";
      runID: string;
      messageID: string;
      conversationID: string;
      step: number;
    }
  | {
      type: "reasoning_finished";
      runID: string;
      messageID: string;
      conversationID: string;
      step: number;
    }
  | {
      type: "reasoning_delta";
      runID: string;
      messageID: string;
      conversationID: string;
      step: number;
      text: string;
    }
  | {
      type: "tool_call";
      runID: string;
      conversationID: string;
      step: number;
      toolCalls: AgentToolCall[];
    }
  | {
      type: "tool_result";
      runID: string;
      conversationID: string;
      step: number;
      toolResults: AgentLiveToolResult[];
    }
  | {
      type: "finished";
      runID: string;
      conversationID: string;
      snapshot: ThreadSnapshot;
    }
  | {
      type: "cancelled" | "failed";
      runID: string;
      conversationID: string;
      message?: string;
      usage?: AgentTokenUsage;
      snapshot?: ThreadSnapshot;
    };

type ToolCallState = {
  args: string;
  name: string;
  step: number;
  runID: string;
  conversationID: string;
};

type ReasoningState = {
  step: number;
  runID: string;
  conversationID: string;
};

export type AgentAguiIdentity = {
  runID: string;
  conversationID: string;
};

export class AgentAguiAdapter {
  private readonly stepByRun = new Map<string, number>();
  private readonly calls = new Map<string, ToolCallState>();
  private readonly reasoning = new Map<string, ReasoningState>();

  push(event: AGUIEvent): AgentConversationEvent[] {
    const record = event as unknown as Record<string, unknown>;
    const identity = readAgentAguiIdentity(event);
    if (!identity) return [];
    const { runID, conversationID } = identity;

    switch (event.type) {
      case "RUN_STARTED":
        return [{ type: "started", runID, conversationID }];
      case "STEP_STARTED": {
        const step = parseStep(record["stepName"]);
        if (step !== undefined) this.stepByRun.set(runID, step);
        return [];
      }
      case "TEXT_MESSAGE_CONTENT": {
        const text = readString(record["delta"]);
        return text === undefined
          ? []
          : [
              {
                type: "text_delta",
                text,
                runID,
                conversationID,
                step: this.currentStep(runID)
              }
            ];
      }
      case "REASONING_MESSAGE_START": {
        const messageID = readString(record["messageId"]);
        if (!messageID) return [];
        const reasoning = {
          runID,
          conversationID,
          step: this.currentStep(runID)
        };
        this.reasoning.set(reasoningStateID(runID, messageID), reasoning);
        return [{ type: "reasoning_started", messageID, ...reasoning }];
      }
      case "REASONING_MESSAGE_CONTENT": {
        const messageID = readString(record["messageId"]);
        const text = readString(record["delta"]);
        const reasoning = messageID
          ? this.reasoning.get(reasoningStateID(runID, messageID))
          : undefined;
        return messageID && reasoning && text !== undefined
          ? [{ type: "reasoning_delta", messageID, text, ...reasoning }]
          : [];
      }
      case "REASONING_MESSAGE_END": {
        const messageID = readString(record["messageId"]);
        if (!messageID) return [];
        const stateID = reasoningStateID(runID, messageID);
        const reasoning = this.reasoning.get(stateID);
        if (!reasoning) return [];
        this.reasoning.delete(stateID);
        return [{ type: "reasoning_finished", messageID, ...reasoning }];
      }
      case "TOOL_CALL_START": {
        const callID = readString(record["toolCallId"]);
        const name = readString(record["toolCallName"]);
        if (callID && name) {
          this.calls.set(callID, {
            name,
            args: "",
            runID,
            conversationID,
            step: this.currentStep(runID)
          });
        }
        return [];
      }
      case "TOOL_CALL_ARGS": {
        const callID = readString(record["toolCallId"]);
        const delta = readString(record["delta"]);
        const call = callID ? this.calls.get(callID) : undefined;
        if (call && delta !== undefined) call.args += delta;
        return [];
      }
      case "TOOL_CALL_END": {
        const callID = readString(record["toolCallId"]);
        const call = callID ? this.calls.get(callID) : undefined;
        if (!call || !callID) return [];
        const toolCall: AgentToolCall = {
          callID,
          name: call.name,
          arguments: call.args
        };
        return [
          {
            type: "tool_call",
            step: call.step,
            runID: call.runID,
            conversationID: call.conversationID,
            toolCalls: [toolCall]
          }
        ];
      }
      case "TOOL_CALL_RESULT": {
        const callID = readString(record["toolCallId"]);
        const content = readString(record["content"]);
        const call = callID ? this.calls.get(callID) : undefined;
        if (!call || !callID || content === undefined) return [];
        this.calls.delete(callID);
        return [
          {
            type: "tool_result",
            step: call.step,
            runID: call.runID,
            conversationID: call.conversationID,
            toolResults: [{ name: call.name, callID, output: content }]
          }
        ];
      }
      default:
        return [];
    }
  }

  clear(runID: string) {
    this.stepByRun.delete(runID);
    for (const [callID, call] of this.calls) {
      if (call.runID === runID) this.calls.delete(callID);
    }
    for (const [messageID, reasoning] of this.reasoning) {
      if (reasoning.runID === runID) this.reasoning.delete(messageID);
    }
  }

  private currentStep(runID: string): number {
    return this.stepByRun.get(runID) ?? 1;
  }
}

export const readAgentAguiIdentity = (event: AGUIEvent): undefined | AgentAguiIdentity => {
  const record = event as unknown as Record<string, unknown>;
  const runID = readString(record["runId"]);
  const conversationID = readString(record["threadId"]);
  return runID && conversationID ? { runID, conversationID } : undefined;
};

const parseStep = (value: unknown): number | undefined => {
  const name = readString(value);
  const match = name ? /(?:^|-)step(\d+)$/.exec(name) : undefined;
  return match?.[1] ? Number(match[1]) : undefined;
};

const reasoningStateID = (runID: string, messageID: string) => `${runID}:${messageID}`;

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;
