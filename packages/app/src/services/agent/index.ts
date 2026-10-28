import { Log } from "@/lib/log";
import { LogLevel } from "@mahiru/log";
import { MainServicesInstance } from "@/types/service";
import { Agent, type AgentLogLevel, type AgentRunOptions } from "@mahiru/agent";

type AgentServiceOptions = Omit<AgentRunOptions, "logger" | "logLevel"> & {
  logLevel: LogLevel;
  onPanicError: NormalFunc<[err: Error]>;
  logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
};

export default class AgentService extends MainServicesInstance {
  private instance?: Agent;
  private readonly starting: Promise<Agent>;
  private stopping?: Promise<void>;
  private readonly options: AgentServiceOptions;

  constructor(options: AgentServiceOptions) {
    super({ name: "agent", onPanic: options.onPanicError, logger: options.logger });
    this.options = options;
    this.starting = Agent.run({
      ...options,
      logLevel: this.toAgentLogLevel(options.logLevel),
      logger: (record) => {
        this.logger(
          record.level === "ERROR" ? "error" : "debug",
          record.target,
          record.message,
          Log.JsonFlat(Log.JsonCompact(record.fields))
        );
      }
    }).then((instance) => {
      this.instance = instance;
      void instance.closed.then(() => {
        if (!this.stopping) this.panic(new Error("Agent 服务已退出"));
      });
      return instance;
    });
  }

  private toAgentLogLevel(level: LogLevel): AgentLogLevel {
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
  }

  get running(): boolean {
    return !this.stopping && Boolean(this.instance?.running);
  }

  getConnection() {
    const instance = this.running ? this.instance : undefined;
    if (!instance) throw new Error("Agent 本次启动未运行；如已重新开启，请重启应用");
    return { endpoint: instance.endpoint, token: this.options.controlToken };
  }

  override async ready() {
    await this.starting;
  }

  override stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.starting
      .then(
        async (instance) => {
          if (!(await instance.stop())) throw new Error("Agent 服务尚未退出，请重试停止操作");
        },
        () => void 0
      )
      .catch((error: unknown) => {
        this.stopping = undefined;
        throw error;
      });
    return this.stopping;
  }
}
