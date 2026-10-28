import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import RendererHTTPConstants from "@/common/constants/http";
import type {
  ApiError,
  AGUIEvent,
  RunAccepted,
  ThreadSummary,
  ThreadSnapshot,
  ProviderConfigView,
  ProviderDescriptor,
  CreateThreadRequest,
  ProviderConfigInput
} from "@mahiru/agent/browser";

type AgentResponse<T> = { data: T; ok: true } | { ok: false; reason: ApiError };
type AgentCreateRunInput = { content: string; configId: string; threadId: string };
type AgentEventOptions = {
  onUnavailable?: () => void;
  onReconnect?: (signal: AbortSignal) => void | Promise<void>;
};

class AgentConnectionUnavailable extends Error {
  constructor(readonly reason: ApiError) {
    super(reason.message);
  }
}

/** Electron 只提供连接配置；控制请求和事件流由窗口直接访问 Rust 服务。 */
export class RendererAgent {
  private static client?: Promise<AxiosInstance>;

  private static getClient(): Promise<AxiosInstance> {
    if (!this.client) {
      this.client = (async () => {
        const connection = await RendererIPC.NormalChannel.send(
          "invoke_agent_connection",
          undefined
        );
        if (!connection.ok) throw new AgentConnectionUnavailable(connection.reason);
        return axios.create({
          baseURL: connection.data.endpoint,
          timeout: RendererHTTPConstants.Timeout,
          headers: { Authorization: `Bearer ${connection.data.token}` }
        });
      })().catch((error) => {
        this.client = undefined;
        throw error;
      });
    }
    return this.client;
  }

  private static async request<T>(
    url: string,
    options: AxiosRequestConfig = {}
  ): Promise<AgentResponse<T>> {
    try {
      const response = await (await this.getClient()).request<T>({ ...options, url });
      return { ok: true, data: response.status === 204 ? (undefined as T) : response.data };
    } catch (error) {
      const payload =
        error instanceof AgentConnectionUnavailable
          ? error.reason
          : axios.isAxiosError(error)
            ? error.response?.data
            : error;
      return {
        ok: false,
        reason: {
          code: typeof payload?.code === "string" ? payload.code : "request_failed",
          message:
            typeof payload?.message === "string"
              ? payload.message
              : error instanceof Error
                ? error.message
                : "Agent 请求失败"
        }
      };
    }
  }

  static listProviders() {
    return this.request<ProviderDescriptor[]>("/v1/providers");
  }
  static listConfigs() {
    return this.request<ProviderConfigView[]>("/v1/configs");
  }
  static createConfig(input: ProviderConfigInput) {
    return this.request<ProviderConfigView>("/v1/configs", { method: "POST", data: input });
  }
  static updateConfig({ id, config }: { id: string; config: ProviderConfigInput }) {
    return this.request<ProviderConfigView>(`/v1/configs/${encodeURIComponent(id)}`, {
      method: "PUT",
      data: config
    });
  }
  static createThread(input: CreateThreadRequest = {}) {
    return this.request<ThreadSummary>("/v1/threads", { method: "POST", data: input });
  }
  static listThreads() {
    return this.request<ThreadSummary[]>("/v1/threads");
  }
  static listRuns() {
    return this.request<RunAccepted[]>("/v1/runs");
  }
  static getThread(id: string) {
    return this.request<ThreadSnapshot>(`/v1/threads/${encodeURIComponent(id)}`);
  }
  static deleteThread(id: string) {
    return this.request<void>(`/v1/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  static async createRun({
    content,
    configId,
    threadId
  }: AgentCreateRunInput): Promise<AgentResponse<RunAccepted>> {
    const path = `/v1/threads/${encodeURIComponent(threadId)}`;
    const configured = await this.request<void>(path + "/config", {
      method: "PUT",
      data: { configId }
    });
    if (!configured.ok) return configured;
    return this.request<RunAccepted>(path + "/runs", { method: "POST", data: { content } });
  }
  static cancelRun(id: string) {
    return this.request<void>(`/v1/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  }

  static listenEvents(
    listener: (event: AGUIEvent) => void,
    options: AgentEventOptions = {}
  ): () => void {
    const controller = new AbortController();
    const unsubscribe = RendererIPC.MessageChannel.listen(
      "message_deliver_agent_feature_settings",
      "process",
      (state) => {
        if (!state.effective.agentEnabled) {
          options.onUnavailable?.();
          controller.abort();
        }
      }
    );
    void (async () => {
      let reconnectDelay = 500;
      let reconnecting = false;
      while (!controller.signal.aborted) {
        const connectedAt = Date.now();
        try {
          const response = await (
            await this.getClient()
          ).get<ReadableStream<Uint8Array>>("/v1/events", {
            adapter: "fetch",
            responseType: "stream",
            timeout: 0,
            signal: controller.signal,
            headers: { Accept: "text/event-stream" }
          });
          if (controller.signal.aborted) {
            await response.data.cancel().catch(() => undefined);
            return;
          }
          if (reconnecting) {
            void Promise.resolve()
              .then(() => {
                if (!controller.signal.aborted) return options.onReconnect?.(controller.signal);
              })
              .catch((error) => Log.warn("agent events", "重连后同步会话失败", error));
          }
          for await (const event of decodeAgentEvents(response.data, controller.signal)) {
            if (controller.signal.aborted) break;
            reconnectDelay = 500;
            listener(event);
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          if (
            error instanceof AgentConnectionUnavailable ||
            (axios.isAxiosError(error) &&
              (error.response?.status === 401 || error.response?.status === 404))
          ) {
            Log.warn("agent events", "Agent 事件连接不可用，停止重连", error);
            options.onUnavailable?.();
            return;
          }
          Log.warn("agent events", "事件流断开，准备重连", error);
        }
        if (Date.now() - connectedAt >= 30_000) reconnectDelay = 500;
        reconnecting = true;
        await waitForReconnect(controller.signal, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      }
    })().finally(unsubscribe);
    return () => controller.abort();
  }
}

export async function* decodeAgentEvents(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<AGUIEvent> {
  const reader = stream.getReader();
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    if (signal?.aborted) return;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) {
          const value: unknown = JSON.parse(data);
          if (
            value &&
            typeof value === "object" &&
            "type" in value &&
            typeof value.type === "string" &&
            "threadId" in value &&
            typeof value.threadId === "string" &&
            "runId" in value &&
            typeof value.runId === "string"
          )
            yield value as AGUIEvent;
          else throw new Error("Agent 事件格式无效");
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function waitForReconnect(signal: AbortSignal, delay: number): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
  });
}
