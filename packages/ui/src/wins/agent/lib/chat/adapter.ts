import type { UIMessageChunk } from "ai";
import type { AGUIEvent } from "@mahiru/agent/browser";

import type {
  AgentUIMessage,
  AgentRunTerminal,
  AgentMessageMetadata,
  AgentAssistantTurnObservability
} from "./interface";

type ToolInput = {
  args: string;
  name: string;
  status: "error" | "available" | "streaming";
};

export class AgentChatAdapter {
  private started = false;
  private finished = false;
  private currentStep?: string;
  private readonly text = new Set<string>();
  private readonly reasoning = new Set<string>();
  private readonly tools = new Map<string, ToolInput>();

  constructor(
    private readonly runID: string,
    private readonly messageID = runID
  ) {}

  /** 冷恢复时先重放快照前缀，后续事件仍由 SDK 接着聚合。 */
  replay(message: AgentUIMessage): UIMessageChunk[] {
    if (this.started || this.finished || message.role !== "assistant") return [];
    this.started = true;
    const chunks: UIMessageChunk[] = [
      {
        type: "start",
        messageId: message.id,
        messageMetadata: { ...message.metadata, runID: this.runID }
      }
    ];
    let step = 0;
    for (const [index, part] of message.parts.entries()) {
      if (part.type === "step-start") {
        if (this.currentStep) chunks.push({ type: "finish-step" });
        this.currentStep = `replay-step-${++step}`;
        chunks.push({ type: "start-step" });
      } else if (part.type === "text" || part.type === "reasoning") {
        const id = `${message.id}-replay-${index}`;
        chunks.push(
          { type: `${part.type}-start`, id },
          { type: `${part.type}-delta`, id, delta: part.text },
          { type: `${part.type}-end`, id }
        );
      } else if (part.type === "dynamic-tool") {
        const toolCallId = part.toolCallId;
        if (part.state === "input-streaming") {
          const args = part.rawInput ?? JSON.stringify(part.input) ?? "";
          this.tools.set(toolCallId, { name: part.toolName, args, status: "streaming" });
          chunks.push(
            {
              type: "tool-input-start",
              toolCallId,
              toolName: part.toolName,
              dynamic: true,
              inputEncoding: part.inputEncoding
            },
            { type: "tool-input-delta", toolCallId, inputTextDelta: args }
          );
          continue;
        }
        this.tools.set(toolCallId, { name: part.toolName, args: "", status: "available" });
        chunks.push({
          type: "tool-input-available",
          toolCallId,
          toolName: part.toolName,
          input: part.input,
          dynamic: true
        });
        if (part.state === "output-available") {
          this.tools.delete(toolCallId);
          chunks.push({
            type: "tool-output-available",
            toolCallId,
            output: part.output,
            dynamic: true
          });
        } else if (part.state === "output-error") {
          this.tools.delete(toolCallId);
          chunks.push({
            type: "tool-output-error",
            toolCallId,
            errorText: part.errorText,
            dynamic: true
          });
        } else if (part.state === "output-denied") {
          this.tools.delete(toolCallId);
          chunks.push({ type: "tool-output-denied", toolCallId });
        }
      }
    }
    return chunks;
  }

  push(event: AGUIEvent): UIMessageChunk[] {
    if (
      this.finished ||
      event.runId !== this.runID ||
      event.type === "RUN_ERROR" ||
      event.type === "RUN_FINISHED"
    )
      return [];

    const chunks: UIMessageChunk[] = [];
    this.start(chunks);

    switch (event.type) {
      case "RUN_STARTED":
        break;
      case "STEP_STARTED":
        if (this.currentStep !== event.stepName) {
          if (this.currentStep) chunks.push({ type: "finish-step" });
          this.currentStep = event.stepName;
          chunks.push({ type: "start-step" });
        }
        break;
      case "STEP_FINISHED":
        if (this.currentStep === event.stepName) {
          this.currentStep = undefined;
          chunks.push({ type: "finish-step" });
        }
        break;
      case "TEXT_MESSAGE_START":
      case "TEXT_MESSAGE_CONTENT":
        if (!this.text.has(event.messageId)) {
          this.text.add(event.messageId);
          chunks.push({ type: "text-start", id: event.messageId });
        }
        if (event.type === "TEXT_MESSAGE_CONTENT")
          chunks.push({ type: "text-delta", id: event.messageId, delta: event.delta });
        break;
      case "TEXT_MESSAGE_END":
        if (this.text.delete(event.messageId))
          chunks.push({ type: "text-end", id: event.messageId });
        break;
      case "REASONING_MESSAGE_START":
      case "REASONING_MESSAGE_CONTENT":
        if (!this.reasoning.has(event.messageId)) {
          this.reasoning.add(event.messageId);
          chunks.push({ type: "reasoning-start", id: event.messageId });
        }
        if (event.type === "REASONING_MESSAGE_CONTENT")
          chunks.push({ type: "reasoning-delta", id: event.messageId, delta: event.delta });
        break;
      case "REASONING_MESSAGE_END":
        if (this.reasoning.delete(event.messageId))
          chunks.push({ type: "reasoning-end", id: event.messageId });
        break;
      case "TOOL_CALL_START":
        if (!this.tools.has(event.toolCallId)) {
          this.tools.set(event.toolCallId, {
            name: event.toolCallName,
            args: "",
            status: "streaming"
          });
          chunks.push({
            type: "tool-input-start",
            toolCallId: event.toolCallId,
            toolName: event.toolCallName,
            dynamic: true
          });
        }
        break;
      case "TOOL_CALL_ARGS": {
        const tool = this.tools.get(event.toolCallId);
        if (tool?.status === "streaming") {
          tool.args += event.delta;
          chunks.push({
            type: "tool-input-delta",
            toolCallId: event.toolCallId,
            inputTextDelta: event.delta
          });
        }
        break;
      }
      case "TOOL_CALL_END":
        this.finishToolInput(event.toolCallId, chunks);
        break;
      case "TOOL_CALL_RESULT":
        if (this.tools.has(event.toolCallId)) {
          this.finishToolInput(event.toolCallId, chunks);
          this.tools.delete(event.toolCallId);
          chunks.push({
            type: "tool-output-available",
            toolCallId: event.toolCallId,
            output: event.content,
            dynamic: true
          });
        }
        break;
    }

    return chunks;
  }

  finish(terminal?: AgentRunTerminal, turns?: AgentAssistantTurnObservability[]): UIMessageChunk[] {
    if (this.finished) return [];
    this.finished = true;
    const chunks: UIMessageChunk[] = [];
    this.start(chunks);

    for (const id of this.text) chunks.push({ type: "text-end", id });
    for (const id of this.reasoning) chunks.push({ type: "reasoning-end", id });
    this.text.clear();
    this.reasoning.clear();

    for (const [toolCallId, tool] of this.tools) {
      if (tool.status === "error") continue;
      chunks.push({
        type: "tool-output-error",
        toolCallId,
        dynamic: true,
        errorText:
          terminal?.error ?? (terminal?.status === "aborted" ? "工具调用已取消" : "工具调用未完成")
      });
    }
    this.tools.clear();
    if (this.currentStep) {
      chunks.push({ type: "finish-step" });
      this.currentStep = undefined;
    }

    const metadata: AgentMessageMetadata = {
      runID: this.runID,
      ...(turns ? { turns } : {}),
      ...(terminal ? { terminal } : {})
    };
    chunks.push({
      type: "finish",
      messageMetadata: metadata,
      finishReason: terminal
        ? terminal.status === "failed"
          ? "error"
          : terminal.status === "aborted"
            ? "interrupted"
            : "other"
        : "stop"
    });
    return chunks;
  }

  private start(chunks: UIMessageChunk[]) {
    if (this.started) return;
    this.started = true;
    chunks.push({
      type: "start",
      messageId: this.messageID,
      messageMetadata: { runID: this.runID }
    });
  }

  private finishToolInput(toolCallId: string, chunks: UIMessageChunk[]) {
    const tool = this.tools.get(toolCallId);
    if (tool?.status !== "streaming") return;
    try {
      const input: unknown = JSON.parse(tool.args);
      tool.status = "available";
      chunks.push({
        type: "tool-input-available",
        toolCallId,
        toolName: tool.name,
        input,
        dynamic: true
      });
    } catch {
      tool.status = "error";
      chunks.push({
        type: "tool-input-error",
        toolCallId,
        toolName: tool.name,
        input: tool.args,
        dynamic: true,
        errorText: "工具参数不是有效的 JSON"
      });
    }
  }
}
