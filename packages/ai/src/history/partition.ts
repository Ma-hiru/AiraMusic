import { AIResult } from "@/result";
import { validateMessages, collectPendingToolCalls } from "@/utils/message";
import type { LLMMessage } from "@/provider/interface";

import type { LLMHistoryTurn } from "./interface";

export function partitionHistoryTurns(messages: readonly LLMMessage[]): AIResult<LLMHistoryTurn[]> {
  const copied = structuredClone(messages) as LLMMessage[];
  const validation = validateMessages(copied);
  if (validation.isErr()) return validation;

  const pending = collectPendingToolCalls(copied);
  if (pending.length) {
    return AIResult.err({
      type: "invalid_conversation",
      message: `历史中存在未完成的工具调用：${pending.map((call) => call.callID).join(", ")}`
    });
  }

  const atoms: LLMHistoryTurn[] = [];
  for (let index = 0; index < copied.length; ) {
    const start = index;
    const message = copied[index]!;
    index++;

    if (message.role === "assistant" && "toolCalls" in message) {
      while (index < copied.length && copied[index]?.role === "tool") index++;
    }

    atoms.push({
      start,
      end: index,
      messages: copied.slice(start, index)
    });
  }

  const turns: LLMHistoryTurn[] = [];
  let current: Undefinable<LLMHistoryTurn>;

  for (const atom of atoms) {
    const startsUserTurn = atom.messages[0]?.role === "user";
    if (startsUserTurn && current) {
      turns.push(current);
      current = undefined;
    }

    if (!current) {
      current = {
        start: atom.start,
        end: atom.end,
        messages: [...atom.messages]
      };
    } else {
      current.end = atom.end;
      current.messages.push(...atom.messages);
    }
  }

  if (current) turns.push(current);
  return AIResult.ok(turns);
}

export function digestHistoryPrefix(messages: readonly LLMMessage[]): string {
  const normalized = messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: message.role,
        name: message.name,
        callID: message.callID,
        content: message.content
      };
    }
    if (message.role === "assistant" && "toolCalls" in message) {
      return {
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls.map((call) => ({
          name: call.name,
          callID: call.callID,
          arguments: call.arguments
        }))
      };
    }
    return { role: message.role, content: message.content };
  });

  const input = JSON.stringify(normalized);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
