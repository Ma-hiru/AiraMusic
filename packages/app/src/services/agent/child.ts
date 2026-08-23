import { Log } from "@/lib/log";
import { LogLevel } from "@mahiru/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import { Agent, type AGUIEvent, type AgentLogLevel, type AgentLogRecord } from "@mahiru/agent";

import { getAgentStoreSecret } from "./secret";

export class RustAgentService {
  private agent?: Agent;
  private eventAbort?: AbortController;
  private readonly listeners = new Set<(event: AGUIEvent) => void>();

  get running(): boolean {
    return this.agent?.running === true;
  }

  listen(listener: (event: AGUIEvent) => void): () => boolean {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(mcpUrl: string): Promise<Agent> {
    if (this.agent) throw new Error("Rust Agent 服务已经启动");
    const agent = await Agent.run({
      port: 0,
      mcpUrl,
      execPath: MainPathResolver.agentBinaryPath,
      dataDir: MainPathResolver.agentDataDir,
      controlToken: MainRuntime.agentControlToken,
      mcpToken: MainRuntime.agentMcpToken,
      storeSecret: getAgentStoreSecret(),
      logLevel: toAgentLogLevel(Log.EnvLevel),
      logger: forwardAgentLog
    });
    this.agent = agent;
    this.eventAbort = new AbortController();
    void this.consumeEvents(agent, this.eventAbort.signal);
    return agent;
  }

  current(): Agent {
    if (!this.agent?.running) throw new Error("Rust Agent 服务未运行");
    return this.agent;
  }

  async stop(): Promise<boolean> {
    const agent = this.agent;
    this.agent = undefined;
    this.eventAbort?.abort();
    this.eventAbort = undefined;
    if (!agent) return true;
    return agent.stop();
  }

  private async consumeEvents(agent: Agent, signal: AbortSignal): Promise<void> {
    while (!signal.aborted && this.agent === agent && agent.running) {
      try {
        for await (const event of agent.events(signal)) {
          for (const listener of this.listeners) listener(event);
        }
      } catch (error) {
        if (signal.aborted || this.agent !== agent || !agent.running) return;
        Log.error("agent service", "AG-UI 事件流中断，准备重连", error);
      }

      if (!(await waitForReconnect(signal))) return;
    }
  }
}

const toAgentLogLevel = (level: LogLevel): AgentLogLevel => {
  switch (level) {
    case LogLevel.TRACE:
      return "TRACE";
    case LogLevel.DEBUG:
      return "DEBUG";
    case LogLevel.INFO:
      return "INFO";
    case LogLevel.WARN:
      return "WARN";
    case LogLevel.ERROR:
      return "ERROR";
    default:
      return "NONE";
  }
};

const forwardAgentLog = (record: AgentLogRecord) => {
  const label = record.target ? `agent:${record.target}` : "agent service";
  const details = Object.entries(record.fields)
    .map(([name, value]) => `${name}=${formatLogValue(value)}`)
    .join(" ");
  const message = details ? `${record.message} ${details}` : record.message;

  switch (record.level) {
    case "TRACE":
      Log.trace(label, message);
      break;
    case "DEBUG":
      Log.debug(label, message);
      break;
    case "INFO":
      Log.info(label, message);
      break;
    case "WARN":
      Log.warn(label, message);
      break;
    case "ERROR":
      Log.error(label, message);
      break;
  }
};

const formatLogValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const waitForReconnect = (signal: AbortSignal, delayMs = 250): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const finish = (value: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(value);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    signal.addEventListener("abort", abort, { once: true });
  });
