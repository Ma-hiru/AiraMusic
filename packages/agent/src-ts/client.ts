import type { AGUIEvent } from "@ag-ui/core";
import type {
  ApiError,
  CreateThreadRequest,
  HealthResponse,
  ProviderConfigInput,
  ProviderConfigView,
  ProviderDescriptor,
  RunAccepted,
  ThreadSnapshot,
  ThreadSummary
} from "./types";
import { decodeAgentEvents } from "./sse";

export class AgentRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AgentRequestError";
  }
}

export class AgentClient {
  constructor(
    readonly endpoint: string,
    private readonly controlToken: string
  ) {}

  health(): Promise<HealthResponse> {
    return this.request("/health");
  }

  listThreads(): Promise<ThreadSummary[]> {
    return this.request("/v1/threads");
  }

  createThread(input: CreateThreadRequest = {}): Promise<ThreadSummary> {
    return this.request("/v1/threads", { method: "POST", body: JSON.stringify(input) });
  }

  getThread(id: string): Promise<ThreadSnapshot> {
    return this.request(`/v1/threads/${encodeURIComponent(id)}`);
  }

  async deleteThread(id: string): Promise<void> {
    await this.request(`/v1/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  listRuns(): Promise<RunAccepted[]> {
    return this.request("/v1/runs");
  }

  createRun(threadID: string, content: string): Promise<RunAccepted> {
    return this.request(`/v1/threads/${encodeURIComponent(threadID)}/runs`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }

  async cancelRun(runID: string): Promise<void> {
    await this.request(`/v1/runs/${encodeURIComponent(runID)}/cancel`, { method: "POST" });
  }

  listConfigs(): Promise<ProviderConfigView[]> {
    return this.request("/v1/configs");
  }

  listProviders(): Promise<ProviderDescriptor[]> {
    return this.request("/v1/providers");
  }

  createConfig(input: ProviderConfigInput): Promise<ProviderConfigView> {
    return this.request("/v1/configs", { method: "POST", body: JSON.stringify(input) });
  }

  updateConfig(id: string, input: ProviderConfigInput): Promise<ProviderConfigView> {
    return this.request(`/v1/configs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input)
    });
  }

  async deleteConfig(id: string): Promise<void> {
    await this.request(`/v1/configs/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async setThreadConfig(threadID: string, configID: string): Promise<void> {
    await this.request(`/v1/threads/${encodeURIComponent(threadID)}/config`, {
      method: "PUT",
      body: JSON.stringify({ configId: configID })
    });
  }

  events(signal?: AbortSignal): AsyncGenerator<AGUIEvent> {
    return decodeAgentEvents(`${this.endpoint}/v1/events`, this.headers(), signal);
  }

  async shutdown(signal?: AbortSignal): Promise<void> {
    await this.request("/shutdown", { method: "POST", signal });
  }

  private headers(json = false): Headers {
    const headers = new Headers({ Authorization: `Bearer ${this.controlToken}` });
    if (json) headers.set("Content-Type", "application/json");
    return headers;
  }

  private async request<T = void>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.controlToken}`);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.endpoint}${path}`, {
      ...init,
      headers
    });
    if (!response.ok) {
      const body = await readError(response);
      throw new AgentRequestError(response.status, body.code, body.message);
    }
    const body = await response.text();
    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const value = (await response.json()) as Partial<ApiError>;
    return {
      code: typeof value.code === "string" ? value.code : "request_failed",
      message:
        typeof value.message === "string"
          ? value.message
          : `Agent 请求失败 (${response.status})`
    };
  } catch {
    return { code: "request_failed", message: `Agent 请求失败 (${response.status})` };
  }
}
