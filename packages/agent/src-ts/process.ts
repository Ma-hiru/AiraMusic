import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AGUIEvent } from "@ag-ui/core";

import { AgentClient } from "./client";
import type { AgentReady } from "./types";

export type AgentLogLevel = "INFO" | "NONE" | "WARN" | "DEBUG" | "ERROR" | "TRACE";

export interface AgentLogRecord {
  message: string;
  target?: string;
  fields: Record<string, unknown>;
  level: Exclude<AgentLogLevel, "NONE">;
}

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const defaultExecutable = join(
  packageDirectory,
  process.platform === "win32" ? "agent.exe" : "agent"
);

export interface AgentRunOptions {
  port: number;
  mcpUrl: string;
  dataDir: string;
  mcpToken: string;
  execPath?: string;
  storeSecret: string;
  controlToken: string;
  logLevel?: AgentLogLevel;
  startupTimeoutMs?: number;
  execArgs?: readonly string[];
  logger?: (record: AgentLogRecord) => void;
}

export class Agent {
  private runningValue = true;
  private readonly client: AgentClient;
  private readonly exited: Promise<void>;

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    readonly endpoint: string,
    controlToken: string
  ) {
    this.client = new AgentClient(endpoint, controlToken);
    this.exited = new Promise((resolve) => {
      child.once("exit", () => {
        this.runningValue = false;
        resolve();
      });
    });
  }

  static async run(options: AgentRunOptions): Promise<Agent> {
    validateOptions(options);
    const executable = options.execPath ?? defaultExecutable;
    if (!existsSync(executable)) throw new Error(`Agent executable not found: ${executable}`);
    const args = [
      ...(options.execArgs ?? []),
      "--port",
      String(options.port),
      "--data-dir",
      options.dataDir,
      "--mcp-url",
      options.mcpUrl,
      "--log-level",
      options.logLevel ?? "INFO"
    ];
    const env = Object.fromEntries(
      Object.entries(process.env).map(([name, value]) => [name, String(value)])
    ) as NodeJS.ProcessEnv;
    Object.assign(env, {
      AIRA_AGENT_CONTROL_TOKEN: options.controlToken,
      AIRA_AGENT_STORE_SECRET: options.storeSecret,
      AIRA_AGENT_MCP_TOKEN: options.mcpToken
    });
    const child: ChildProcessWithoutNullStreams = spawn(executable, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env
    });
    child.stderr.setEncoding("utf8");
    listenAgentLogs(child, options.logger);

    try {
      const ready = await waitUntilReady(child, options.startupTimeoutMs ?? 10_000);
      return new Agent(child, `http://127.0.0.1:${ready.port}`, options.controlToken);
    } catch (error) {
      child.stdin.end();
      child.kill();
      throw error;
    }
  }

  get running(): boolean {
    return this.runningValue;
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  health() {
    return this.client.health();
  }

  listThreads() {
    return this.client.listThreads();
  }

  createThread(...args: Parameters<AgentClient["createThread"]>) {
    return this.client.createThread(...args);
  }

  getThread(...args: Parameters<AgentClient["getThread"]>) {
    return this.client.getThread(...args);
  }

  deleteThread(...args: Parameters<AgentClient["deleteThread"]>) {
    return this.client.deleteThread(...args);
  }

  listRuns() {
    return this.client.listRuns();
  }

  listProviders() {
    return this.client.listProviders();
  }

  createRun(...args: Parameters<AgentClient["createRun"]>) {
    return this.client.createRun(...args);
  }

  cancelRun(...args: Parameters<AgentClient["cancelRun"]>) {
    return this.client.cancelRun(...args);
  }

  listConfigs() {
    return this.client.listConfigs();
  }

  createConfig(...args: Parameters<AgentClient["createConfig"]>) {
    return this.client.createConfig(...args);
  }

  updateConfig(...args: Parameters<AgentClient["updateConfig"]>) {
    return this.client.updateConfig(...args);
  }

  deleteConfig(...args: Parameters<AgentClient["deleteConfig"]>) {
    return this.client.deleteConfig(...args);
  }

  setThreadConfig(...args: Parameters<AgentClient["setThreadConfig"]>) {
    return this.client.setThreadConfig(...args);
  }

  events(signal?: AbortSignal): AsyncGenerator<AGUIEvent> {
    return this.client.events(signal);
  }

  async stop(timeoutMs = 5_000): Promise<boolean> {
    if (!this.runningValue) return true;
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs / 2));
    try {
      await this.client.shutdown(controller.signal);
    } catch {
      this.child.stdin.end();
    } finally {
      clearTimeout(requestTimer);
    }

    if (await waitForExit(this.exited, timeoutMs)) return true;
    this.child.stdin.end();
    this.child.kill();
    await waitForExit(this.exited, Math.min(timeoutMs, 1_000));
    return false;
  }
}

function validateOptions(options: AgentRunOptions) {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
    throw new Error("Agent port must be an integer between 0 and 65535");
  }
  for (const [name, value] of Object.entries({
    dataDir: options.dataDir,
    mcpUrl: options.mcpUrl,
    controlToken: options.controlToken,
    storeSecret: options.storeSecret,
    mcpToken: options.mcpToken
  })) {
    if (!value) throw new Error(`Agent option ${name} cannot be empty`);
  }
  if (options.logLevel && !AGENT_LOG_LEVELS.includes(options.logLevel)) {
    throw new Error(`Agent log level is invalid: ${options.logLevel}`);
  }
}

const AGENT_LOG_LEVELS: readonly AgentLogLevel[] = [
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "NONE"
];

function listenAgentLogs(
  child: ChildProcessWithoutNullStreams,
  logger?: (record: AgentLogRecord) => void
) {
  if (!logger) {
    child.stderr.resume();
    return;
  }

  let buffer = "";
  const flushLine = (line: string) => {
    const content = line.trim();
    if (content) logger(parseAgentLogRecord(content));
  };
  child.stderr.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      flushLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  });
  child.stderr.once("end", () => {
    flushLine(buffer);
    buffer = "";
  });
}

function parseAgentLogRecord(line: string): AgentLogRecord {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const level = readAgentLogLevel(parsed["level"]);
    const sourceFields = isRecord(parsed["fields"]) ? parsed["fields"] : {};
    const fields = { ...sourceFields };
    const fieldMessage = fields["message"];
    delete fields["message"];
    const message =
      typeof fieldMessage === "string"
        ? fieldMessage
        : typeof parsed["message"] === "string"
          ? parsed["message"]
          : line;
    return {
      level,
      message,
      fields,
      ...(typeof parsed["target"] === "string" ? { target: parsed["target"] } : {})
    };
  } catch {
    return { level: "ERROR", message: line, fields: {} };
  }
}

function readAgentLogLevel(value: unknown): AgentLogRecord["level"] {
  return value === "TRACE" ||
    value === "DEBUG" ||
    value === "INFO" ||
    value === "WARN" ||
    value === "ERROR"
    ? value
    : "ERROR";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function waitUntilReady(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<AgentReady> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    const finish = (error?: Error, ready?: AgentReady) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve(ready!);
    };
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      try {
        const ready = JSON.parse(line) as Partial<AgentReady>;
        if (
          ready.type !== "ready" ||
          ready.protocolVersion !== 1 ||
          !Number.isInteger(ready.port) ||
          (ready.port ?? 0) <= 0
        ) {
          throw new Error("invalid readiness record");
        }
        finish(undefined, ready as AgentReady);
      } catch {
        finish(new Error("Agent readiness record 无效"));
      }
    };
    const onError = () => finish(new Error("Agent 子进程启动失败"));
    const onExit = () => finish(new Error("Agent 在就绪前退出"));
    const timer = setTimeout(() => finish(new Error("Agent 启动超时")), timeoutMs);
    child.stdout.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function waitForExit(exited: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: undefined | NodeJS.Timeout;
  try {
    return await Promise.race([
      exited.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
