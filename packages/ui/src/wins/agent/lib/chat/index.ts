import { Chat } from "@ai-sdk/react";
import { Log } from "@/common/lib/log";
import {
  agentConversationStatesAtom,
  createAgentConversationState,
  agentSelectedConversationIDAtom,
  agentUpdateConversationStateAtom
} from "@/wins/agent/atoms/agent";
import type { createStore } from "jotai";
import type { ChatTransport, UIMessageChunk } from "ai";
import type { AgentConversationState } from "@/wins/agent/atoms/agent";
import type { AGUIEvent, ThreadSnapshot } from "@mahiru/agent/browser";

import { RendererAgent } from "../agent";
import { AgentChatAdapter } from "./adapter";
import { toAgentUIMessages } from "./message";
import type { AgentUIMessage, AgentRunTerminal } from "./interface";
import { parseAgentTurnUsage, readStoredRunFailure } from "./observability";

type AgentStore = ReturnType<typeof createStore>;
type AgentSubmission = {
  text: string;
  configID: string;
  events: AGUIEvent[];
  accepted: ReturnType<typeof Promise.withResolvers<boolean>>;
};
type AgentChatStream = {
  runID: string;
  release: NormalFunc;
  adapter: AgentChatAdapter;
  controller: ReadableStreamDefaultController<UIMessageChunk>;
};

const preserveThreadMetadata = (
  snapshot: ThreadSnapshot,
  state: AgentConversationState
): Pick<AgentConversationState, "conversation" | "metadataUpdatedAt"> => {
  const current = state.conversation;
  const updatedAt = Math.max(current?.updatedAt ?? 0, state.metadataUpdatedAt ?? 0);
  return {
    metadataUpdatedAt: Math.max(updatedAt, snapshot.updatedAt),
    conversation:
      current && updatedAt > snapshot.updatedAt
        ? {
            ...snapshot,
            name: current.name,
            createdAt: current.createdAt,
            auxiliaryUsage: current.auxiliaryUsage ?? snapshot.auxiliaryUsage
          }
        : snapshot
  };
};

/** 每个 Jotai store 持有自己的会话实例；切换页面只更换 SDK 的订阅。 */
export class RendererAgentChat {
  private static readonly stores = new WeakMap<AgentStore, Map<string, RendererAgentChat>>();

  static get(store: AgentStore, conversationID: string) {
    let chats = this.stores.get(store);
    if (!chats) this.stores.set(store, (chats = new Map()));
    let chat = chats.get(conversationID);
    if (!chat) chats.set(conversationID, (chat = new RendererAgentChat(store, conversationID)));
    return chat;
  }

  static remove(store: AgentStore, conversationID: string) {
    const chats = this.stores.get(store);
    const entry = chats?.get(conversationID);
    if (entry) {
      entry.disposed = true;
      entry.eventVersion++;
      entry.submission?.accepted.resolve(false);
      entry.submission = undefined;
      void entry.chat.dispose();
    }
    chats?.delete(conversationID);
  }

  static disconnect(store: AgentStore) {
    for (const entry of this.stores.get(store)?.values() ?? []) {
      if (entry.stopping) continue;
      entry.eventVersion++;
      const stopping = entry.chat.stop();
      entry.stopping = stopping;
      void stopping.finally(() => {
        if (entry.stopping === stopping) entry.stopping = undefined;
      });
    }
  }

  readonly chat: Chat<AgentUIMessage>;
  private stream?: AgentChatStream;
  private submission?: AgentSubmission;
  private completion: Promise<void> = Promise.resolve();
  private pendingError?: string;
  private settlingRunID = "";
  private eventVersion = 0;
  private disposed = false;
  private stopping?: Promise<void>;
  private releaseWhenIdle = false;

  private constructor(
    private readonly store: AgentStore,
    readonly conversationID: string
  ) {
    const transport: ChatTransport<AgentUIMessage> = {
      resumeStreamIsReplay: true,
      sendMessages: async ({ trigger, abortSignal }) => {
        const submission = this.submission;
        if (trigger !== "submit-message" || !submission) throw new Error("不支持此会话操作");
        const stream = this.createStream("", abortSignal);
        try {
          const result = await RendererAgent.createRun({
            content: submission.text,
            configId: submission.configID,
            threadId: this.conversationID
          });
          if (!result.ok) throw new Error(`${result.reason.code}: ${result.reason.message}`);
          if (this.disposed) return stream;
          this.update((state) => ({
            ...state,
            sending: false,
            latestRunID: result.data.runId,
            runningRunID: result.data.runId
          }));
          if (this.stream) {
            this.stream.runID = result.data.runId;
            this.stream.adapter = new AgentChatAdapter(result.data.runId);
            this.write(
              this.stream.adapter.push({
                type: "RUN_STARTED",
                threadId: this.conversationID,
                runId: result.data.runId
              })
            );
          }
          this.submission = undefined;
          submission.accepted.resolve(true);
          for (const event of submission.events) void this.push(event);
          return stream;
        } catch (error) {
          this.closeStream();
          submission.accepted.resolve(false);
          throw error;
        }
      },
      reconnectToStream: async ({ abortSignal }) => {
        if (this.disposed) return null;
        const runID = this.state.runningRunID;
        if (!runID) return null;
        const message = this.chat.lastMessage;
        return this.createStream(
          runID,
          abortSignal,
          message?.role === "assistant" && message.metadata?.runID === runID ? message : undefined
        );
      },
      close: () => this.closeStream()
    };
    const state = this.state;
    const conversation = state.conversation;
    const messages = conversation ? toAgentUIMessages(conversation) : [];
    if (
      state.runningRunID &&
      state.pendingUserMessage &&
      (conversation?.runtime.status !== "running" ||
        conversation.runtime.runId !== state.runningRunID)
    ) {
      messages.push({
        id: `${state.runningRunID}-user`,
        role: "user",
        parts: [{ type: "text", text: state.pendingUserMessage, state: "done" }]
      });
    }
    this.chat = new Chat<AgentUIMessage>({
      id: conversationID || "agent-empty",
      messages,
      transport,
      onError: (error) => Log.warn("agent chat", error)
    });
  }

  get version() {
    return this.eventVersion;
  }

  retain() {
    this.releaseWhenIdle = false;
  }

  release() {
    this.releaseWhenIdle = true;
    queueMicrotask(() => this.releaseIfIdle());
  }

  private releaseIfIdle() {
    const state = this.state;
    if (
      !this.releaseWhenIdle ||
      this.store.get(agentSelectedConversationIDAtom) === this.conversationID ||
      state.sending ||
      state.runningRunID ||
      state.recovering ||
      this.submission ||
      this.stream ||
      this.stopping
    )
      return;
    RendererAgentChat.remove(this.store, this.conversationID);
  }

  private get state() {
    return (
      this.store.get(agentConversationStatesAtom)[this.conversationID] ??
      createAgentConversationState()
    );
  }

  private update(update: NormalFunc<[AgentConversationState], AgentConversationState>) {
    if (this.disposed) return;
    this.store.set(agentUpdateConversationStateAtom, {
      conversationID: this.conversationID,
      update
    });
  }

  async submit(text: string, configID: string) {
    if (this.stopping) await this.stopping;
    const state = this.state;
    if (
      this.disposed ||
      !text ||
      !configID ||
      !this.conversationID ||
      this.submission ||
      state.sending ||
      state.runningRunID ||
      state.recovering
    )
      return false;
    const previousMessages = this.chat.messages;
    const submission: AgentSubmission = {
      text,
      configID,
      events: [],
      accepted: Promise.withResolvers<boolean>()
    };
    this.submission = submission;
    this.eventVersion++;
    this.pendingError = undefined;
    this.update((current) => ({ ...current, sending: true, pendingUserMessage: text }));
    this.completion = this.chat
      .sendMessage({ text })
      .finally(() => submission.accepted.resolve(false));
    const accepted = await submission.accepted.promise;
    if (!accepted) {
      await this.completion;
      if (this.submission === submission) {
        this.submission = undefined;
        this.chat.messages = previousMessages;
        this.update((current) => ({ ...current, sending: false, pendingUserMessage: "" }));
        this.releaseIfIdle();
      }
    }
    return accepted;
  }

  async cancel() {
    if (this.disposed) return;
    const runID = this.state.runningRunID;
    if (!runID) return;
    const result = await RendererAgent.cancelRun(runID);
    if (!result.ok) throw new Error(`${result.reason.code}: ${result.reason.message}`);
  }

  async push(event: AGUIEvent): Promise<boolean> {
    if (this.stopping) await this.stopping;
    if (this.disposed || event.threadId !== this.conversationID) return false;
    if (this.submission) {
      this.eventVersion++;
      this.submission.events.push(event);
      if (this.submission.events.length > 256) this.submission.events.shift();
      return false;
    }
    const state = this.state;
    const expectedRunID = state.runningRunID || state.latestRunID;
    if (expectedRunID && expectedRunID !== event.runId) return false;
    if (this.settlingRunID === event.runId) return false;
    this.eventVersion++;
    if (!this.stream) {
      this.update((current) => ({
        ...current,
        latestRunID: event.runId,
        runningRunID: event.runId
      }));
      this.completion = this.chat.resumeStream();
    }
    if (!this.stream || this.stream.runID !== event.runId) return false;
    this.update((current) => (current.recovering ? { ...current, recovering: false } : current));
    this.write(this.stream.adapter.push(event));
    if (event.type === "RUN_ERROR") {
      this.pendingError = event.message;
      if (event.usages == null) {
        this.write([
          {
            type: "message-metadata",
            messageMetadata: {
              runID: event.runId,
              terminal: {
                id: `${event.runId}-terminal`,
                type: "terminal",
                status: "failed",
                runID: event.runId,
                error: event.message
              }
            }
          }
        ]);
        return false;
      }
    } else if (event.type !== "RUN_FINISHED") return false;

    const usage = parseAgentTurnUsage(event.usages);
    const result = event.type === "RUN_FINISHED" ? (event.result ?? "success") : "error";
    const cancelled = result === "cancel" || result === "已取消";
    const terminal: undefined | AgentRunTerminal =
      this.pendingError || result !== "success"
        ? {
            id: `${event.runId}-terminal`,
            type: "terminal",
            runID: event.runId,
            status: this.pendingError
              ? "failed"
              : cancelled
                ? "aborted"
                : result === "max-step"
                  ? "max_steps"
                  : "failed",
            error: this.pendingError ?? (cancelled || result === "max-step" ? undefined : result),
            usage: usage?.usage
          }
        : undefined;
    this.settlingRunID = event.runId;
    const version = this.eventVersion;
    this.closeStream(
      terminal,
      usage ? [{ ...usage, runID: event.runId, status: "complete" }] : undefined
    );
    const [snapshot] = await Promise.all([
      RendererAgent.getThread(this.conversationID),
      this.completion
    ]);
    if (this.eventVersion !== version || this.state.runningRunID !== event.runId) return false;
    if (snapshot.ok) this.replaceMessages(snapshot.data, terminal);
    this.pendingError = undefined;
    this.update((current) => ({
      ...current,
      sending: false,
      recovering: !snapshot.ok,
      runningRunID: "",
      pendingUserMessage: "",
      ...(snapshot.ok ? preserveThreadMetadata(snapshot.data, current) : {})
    }));
    this.releaseIfIdle();
    return true;
  }

  async restore(
    snapshot: ThreadSnapshot,
    isCurrent: NormalFunc<[], boolean> = () => true,
    reconnect = false
  ) {
    if (this.stopping) await this.stopping;
    if (this.disposed || !isCurrent()) return;
    const state = this.state;
    if (state.sending && !state.runningRunID) return;
    const runID = snapshot.runtime.status === "running" ? (snapshot.runtime.runId ?? "") : "";
    if (!reconnect && this.stream && this.stream.runID === runID) {
      this.update((current) => ({
        ...current,
        ...preserveThreadMetadata(snapshot, current)
      }));
      return;
    }
    const version = ++this.eventVersion;
    this.closeStream(readStoredRunFailure(snapshot));
    await this.completion;
    if (this.eventVersion !== version || !isCurrent()) return;
    this.replaceMessages(snapshot);
    this.settlingRunID = runID ? "" : (snapshot.runtime.runId ?? state.latestRunID);
    this.pendingError = undefined;
    this.update((current) => ({
      ...current,
      sending: false,
      recovering: !!runID,
      runningRunID: runID,
      latestRunID: snapshot.runtime.runId ?? current.latestRunID,
      pendingUserMessage: runID ? current.pendingUserMessage : "",
      ...preserveThreadMetadata(snapshot, current)
    }));
    if (runID) this.completion = this.chat.resumeStream();
    else this.releaseIfIdle();
  }

  private replaceMessages(snapshot: ThreadSnapshot, terminal?: AgentRunTerminal) {
    const messages = toAgentUIMessages(snapshot);
    const previous = this.chat.lastMessage;
    const previousUsers = this.chat.messages.filter((message) => message.role === "user");
    const users = messages.filter((message) => message.role === "user");
    const userText = (message?: AgentUIMessage) =>
      message?.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    const sameTurn =
      previous?.role === "assistant" &&
      previousUsers.length === users.length &&
      userText(previousUsers.at(-1)) === userText(users.at(-1)) &&
      (!snapshot.runtime.runId || snapshot.runtime.runId === previous.metadata?.runID);
    let last = messages.at(-1);
    if (sameTurn && last?.role === "assistant") {
      const storedTerminal = last.metadata?.terminal;
      last.metadata = { ...previous.metadata, ...last.metadata };
      if (storedTerminal) {
        last.metadata.terminal = {
          ...storedTerminal,
          usage: storedTerminal.usage ?? previous.metadata?.terminal?.usage
        };
      }
    }
    terminal ??= sameTurn ? (last?.metadata?.terminal ?? previous.metadata?.terminal) : undefined;
    if (terminal) {
      if (last?.role !== "assistant") {
        last = { id: `${terminal.runID}-assistant`, role: "assistant", parts: [] };
        messages.push(last);
      }
      last.metadata = { ...last.metadata, terminal };
    }
    this.chat.messages = messages;
  }

  private createStream(runID: string, signal?: AbortSignal, message?: AgentUIMessage) {
    let stream: AgentChatStream;
    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        stream = {
          runID,
          controller,
          adapter: new AgentChatAdapter(runID, message?.id ?? runID),
          release: () => signal?.removeEventListener("abort", abort)
        };
        const abort = () => {
          if (this.stream === stream) this.closeStream();
        };
        this.stream = stream;
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        else if (message) this.write(stream.adapter.replay(message));
        else if (runID)
          this.write(
            stream.adapter.push({
              type: "RUN_STARTED",
              threadId: this.conversationID,
              runId: runID
            })
          );
      },
      cancel: () => {
        stream.release();
        if (this.stream === stream) this.stream = undefined;
      }
    });
  }

  private write(chunks: UIMessageChunk[]) {
    for (const chunk of chunks) this.stream?.controller.enqueue(chunk);
  }

  private closeStream(
    terminal?: AgentRunTerminal,
    turns?: NonNullable<AgentUIMessage["metadata"]>["turns"]
  ) {
    const stream = this.stream;
    if (!stream) return;
    this.write(stream.adapter.finish(terminal, turns));
    this.stream = undefined;
    stream.release();
    stream.controller.close();
  }
}
