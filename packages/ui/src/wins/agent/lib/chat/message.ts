import type { ThreadSnapshot } from "@mahiru/agent/browser";

import type { AgentUIMessage } from "./interface";
import { parseStoredTurnUsage, storedRunErrorTerminal } from "./observability";

export function toAgentUIMessages(snapshot: ThreadSnapshot): AgentUIMessage[] {
  const messages: AgentUIMessage[] = [];
  const calls = new Map<string, number>();
  let assistant: undefined | AgentUIMessage;
  let lastAssistantIndex = -1;
  let userIndex = -1;
  let step = 0;

  const getAssistant = () => {
    if (!assistant) {
      assistant = {
        id: `${snapshot.id}-assistant-${userIndex}`,
        role: "assistant",
        parts: [],
        metadata: {}
      };
      messages.push(assistant);
    }
    return assistant;
  };

  /** 只说明已结束记录缺少最终回复的事实，不推断终止原因。 */
  const finishAssistant = (latest: boolean) => {
    const last = snapshot.messages[lastAssistantIndex];
    const usage = assistant?.metadata?.turns?.at(-1)?.usage;
    if (
      !assistant ||
      !last ||
      !usage ||
      assistant.metadata?.terminal ||
      last.content.trim() ||
      last.toolCalls?.length ||
      (latest && snapshot.runtime.status === "running")
    )
      return;
    assistant.metadata = {
      ...assistant.metadata,
      terminal: {
        id: `stored-missing-reply-${lastAssistantIndex}`,
        type: "terminal",
        status: "failed",
        error: last.reasoningContent?.trim()
          ? "历史记录仅包含思考内容，未保存最终回复或有效工具调用"
          : "历史记录未包含最终回复或有效工具调用"
      }
    };
  };

  for (const [index, message] of snapshot.messages.entries()) {
    if (message.role === "system") {
      const terminal = /^\[(cancel|max-step)\]: /.exec(message.content);
      if (userIndex >= 0 && terminal) {
        const current = getAssistant();
        if (!current.metadata?.terminal) {
          current.metadata = {
            ...current.metadata,
            terminal: {
              id: `stored-terminal-${index}`,
              type: "terminal",
              status: terminal[1] === "cancel" ? "aborted" : "max_steps"
            }
          };
        }
      }
      continue;
    }
    if (message.role === "user") {
      finishAssistant(false);
      messages.push({
        id: `${snapshot.id}-user-${index}`,
        role: "user",
        parts: [{ type: "text", text: message.content, state: "done" }]
      });
      assistant = undefined;
      lastAssistantIndex = -1;
      userIndex = index;
      step = 0;
      calls.clear();
      continue;
    }

    if (message.role === "inner") {
      if (message.innerType === "usage") {
        const turn = parseStoredTurnUsage(message.content);
        if (!turn) continue;
        const current = getAssistant();
        current.metadata = {
          ...current.metadata,
          turns: [...(current.metadata?.turns ?? []), { ...turn, status: "complete" }]
        };
      } else if (message.innerType === "error") {
        const current = getAssistant();
        current.metadata = {
          ...current.metadata,
          terminal: storedRunErrorTerminal(snapshot, index)
        };
      }
      continue;
    }

    const current = getAssistant();
    if (message.role === "assistant") {
      lastAssistantIndex = index;
      step++;
      current.parts.push({ type: "step-start" });
      if (message.reasoningContent?.trim()) {
        current.parts.push({ type: "reasoning", text: message.reasoningContent, state: "done" });
      }
      if (message.content) {
        current.parts.push({ type: "text", text: message.content, state: "done" });
      }
      for (const call of message.toolCalls ?? []) {
        calls.set(call.id, current.parts.length);
        current.parts.push({
          type: "dynamic-tool",
          toolName: call.name,
          toolCallId: call.id,
          state: "input-available",
          input: call.args
        });
      }
      continue;
    }

    if (message.role === "tool") {
      const callID = message.toolCallId ?? `${snapshot.id}-tool-${index}`;
      const callIndex = calls.get(callID);
      const call = callIndex === undefined ? undefined : current.parts[callIndex];
      if (call?.type === "dynamic-tool" && callIndex !== undefined) {
        current.parts[callIndex] = {
          type: "dynamic-tool",
          toolName: call.toolName,
          toolCallId: callID,
          state: "output-available",
          input: call.input,
          output: message.content
        };
      } else {
        if (!step) {
          step++;
          current.parts.push({ type: "step-start" });
        }
        current.parts.push({
          type: "dynamic-tool",
          toolName: "tool",
          toolCallId: callID,
          state: "output-available",
          input: undefined,
          output: message.content
        });
      }
    }
  }

  finishAssistant(true);

  for (const message of messages) {
    const terminal = message.metadata?.terminal;
    const usage = message.metadata?.turns?.at(-1)?.usage;
    if (terminal && usage) terminal.usage = usage;
    if (!terminal) continue;
    message.parts = message.parts.map((part) =>
      part.type === "dynamic-tool" && part.state === "input-available"
        ? { ...part, state: "output-error", errorText: "工具调用未完成" }
        : part
    );
  }

  // 历史快照只暴露当前 run 的身份，不把它赋给更早的用户轮次。
  const runID = snapshot.runtime.runId;
  if (assistant && runID) {
    assistant.metadata = { ...assistant.metadata, runID };
    if (assistant.metadata.turns) {
      assistant.metadata.turns = assistant.metadata.turns.map((turn) => ({
        ...turn,
        runID
      }));
    }
  }
  return messages;
}
