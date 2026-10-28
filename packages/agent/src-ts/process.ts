import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { AgentReady, AgentLogLevel, AgentLogRecord, HealthResponse } from "./types";

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
  private isRunning = true;
  private readonly exited: Promise<void>;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly controlToken: string;
  readonly endpoint: string;

  get running(): boolean {
    return this.isRunning;
  }

  get closed(): Promise<void> {
    return this.exited;
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  private constructor(
    child: ChildProcessWithoutNullStreams,
    endpoint: string,
    controlToken: string
  ) {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.endpoint = endpoint;
    this.controlToken = controlToken;
    this.exited = promise;
    this.child = child.once("exit", () => {
      this.isRunning = false;
      resolve();
    });
  }

  private request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = this.endpoint + path;
    const init = {
      ...options,
      headers: { ...options?.headers, Authorization: `Bearer ${this.controlToken}` }
    };
    return fetch(url, init)
      .then((response) => {
        if (!response.ok) {
          console.error(`Agent 连接失败 (${response.status})`);
          throw new Error(`Agent 连接失败 (${response.status})`);
        }
        return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
      })
      .catch((err) => {
        console.error(`Agent 连接失败`, err);
        throw new Error(`Agent 连接失败 (${err})`);
      });
  }

  private waitForExit(timeoutMs: number): Promise<boolean> {
    const { resolve, promise: timeout } = Promise.withResolvers<false>();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    return Promise.race([this.exited.then(() => true), timeout]).finally(() => {
      clearTimeout(timer);
      resolve(false);
    });
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async stop(timeoutMs = 2_000): Promise<boolean> {
    if (!this.isRunning) return true;
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs / 2));

    try {
      await this.request<void>("/shutdown", { method: "POST", signal: controller.signal });
    } catch {
      this.child.stdin.end();
    } finally {
      clearTimeout(requestTimer);
    }

    if (await this.waitForExit(timeoutMs)) return true;
    this.child.stdin.end();
    this.child.kill();
    return await this.waitForExit(Math.min(timeoutMs, 1_000));
  }

  private static validateOptions(options: AgentRunOptions) {
    if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
      throw new Error("Agent port must be an integer between 0 and 65535");
    }

    const require = {
      dataDir: options.dataDir,
      mcpUrl: options.mcpUrl,
      controlToken: options.controlToken,
      storeSecret: options.storeSecret,
      mcpToken: options.mcpToken
    };
    for (const [name, value] of Object.entries(require)) {
      if (!value) throw new Error(`Agent option ${name} cannot be empty`);
    }

    const AGENT_LOG_LEVELS: AgentLogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "NONE"];
    if (options.logLevel && !AGENT_LOG_LEVELS.includes(options.logLevel)) {
      throw new Error(`Agent log level is invalid: ${options.logLevel}`);
    }

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

    return { executable, args, env };
  }
  private static listenAgentLogs(
    child: ChildProcessWithoutNullStreams,
    loglevel?: AgentLogLevel,
    logger?: NormalFunc<[record: AgentLogRecord]>
  ) {
    child.stderr.setEncoding("utf8");

    if (!logger) {
      child.stderr.resume();
      return;
    }

    let buffer = "";
    const currentLevelNumber = loglevel && loglevelToNumber(loglevel);
    const parseAgentLogRecord = (line: string): null | AgentLogRecord => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const level = readAgentLogLevel(parsed["level"]);
        if (currentLevelNumber && loglevelToNumber(level) < currentLevelNumber) return null;
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
    };
    const flushLine = (line: string) => {
      const content = line.trim();
      if (content) {
        const record = parseAgentLogRecord(content);
        record && logger(record);
      }
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
  private static waitUntilReady(
    child: ChildProcessWithoutNullStreams,
    timeoutMs: number
  ): Promise<AgentReady> {
    const { reject, promise, resolve } = Promise.withResolvers<AgentReady>();

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

    return promise;
  }
  static async run(options: AgentRunOptions): Promise<Agent> {
    const { env, args, executable } = this.validateOptions(options);
    const child: ChildProcessWithoutNullStreams = spawn(executable, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env
    });
    this.listenAgentLogs(child, options.logLevel, options.logger);

    try {
      const ready = await this.waitUntilReady(child, options.startupTimeoutMs ?? 15_000);
      return new Agent(child, `http://127.0.0.1:${ready.port}`, options.controlToken);
    } catch (error) {
      child.stdin.end();
      child.kill();
      throw error;
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readAgentLogLevel = (
  value: unknown,
  dft: AgentLogRecord["level"] = "ERROR"
): AgentLogRecord["level"] => {
  return value === "TRACE" ||
    value === "DEBUG" ||
    value === "INFO" ||
    value === "WARN" ||
    value === "ERROR"
    ? value
    : dft;
};

const loglevelToNumber = (level: AgentLogLevel) => {
  switch (level) {
    case "TRACE":
      return 0;
    case "DEBUG":
      return 1;
    case "INFO":
      return 2;
    case "WARN":
      return 3;
    case "ERROR":
      return 4;
    case "NONE":
      return 5;
  }
};
