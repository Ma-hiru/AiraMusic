import { fileURLToPath } from "node:url";
import { app, utilityProcess, type UtilityProcess } from "electron";
import { Log } from "@/lib/log";
import { LogLevel } from "@mahiru/log";
import { MainServicesInstance, type MainServicesName } from "@/types/service";
import type {
  Message,
  StopMessage,
  ErrorMessage,
  StartMessage,
  ResultMessage,
  ControlMessage
} from "@/types/child";

export type MainChildEntryOptions = {
  metaUrl: string;
  childPath: string;
  logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
  /** 服务非预期退出时调用，也就是 on("exit") */
  onPanicError: NormalFunc<[err: Error]>;
  /** @default true */
  autoStart?: boolean;
  stopTimeout?: number;
  readyTimeout?: number;
  env?: NodeJS.ProcessEnv;
  serviceName: MainServicesName;
};

export abstract class MainChildEntry<
  ParentMessage extends Message | ControlMessage,
  ChildMessage extends Message | ResultMessage
> extends MainServicesInstance {
  readonly childPath: string;
  readonly serviceName: MainServicesName;
  readonly env?: NodeJS.ProcessEnv;
  readonly stopTimeout: number;
  readonly readyTimeout: number;

  protected child?: UtilityProcess;
  protected starting = false;
  protected startPromise?: Promise<void>;
  protected stopping = false;
  protected stopped = false;
  private startController?: AbortController;
  private stopPromise?: Promise<void>;
  private readyReceived = false;

  protected constructor(options: MainChildEntryOptions) {
    super({ name: options.serviceName, logger: options.logger, onPanic: options.onPanicError });
    this.serviceName = options.serviceName;
    this.childPath = fileURLToPath(new URL(options.childPath, options.metaUrl));
    this.stopTimeout = options.stopTimeout ?? 2000;
    this.readyTimeout = options.readyTimeout ?? 15_000;
    this.env = options.env;

    if (options.autoStart ?? true) {
      void this.start();
    }
  }

  override async ready() {
    await this.startPromise;
  }

  start(): Promise<void> {
    if (this.starting) return this.startPromise!;
    if (this.child || this.stopping) return Promise.resolve();
    this.stopped = false;
    this.readyReceived = false;
    this.starting = true;
    this.stopPromise = undefined;
    const controller = new AbortController();
    this.startController = controller;
    const timer = setTimeout(() => {
      controller.abort(new Error(`${this.serviceName} start timed out`));
    }, this.readyTimeout);
    const operation = new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      this.startChild(controller.signal)
        .then(resolve, reject)
        .finally(() => {
          controller.signal.removeEventListener("abort", onAbort);
        });
    })
      .catch(async (error: unknown) => {
        await Promise.allSettled([this.stop()]);
        throw error;
      })
      .finally(() => {
        clearTimeout(timer);
        this.starting = false;
        this.startController = undefined;
      });
    this.startPromise = operation;
    // autoStart 的调用者稍后才会调用 ready()，失败仍由 ready() 向上传递
    void operation.catch(() => undefined);
    return operation;
  }

  private async startChild(signal: AbortSignal) {
    await app.whenReady();
    signal.throwIfAborted();
    await this.beforeStart();
    signal.throwIfAborted();

    this.child = utilityProcess.fork(this.childPath, [], {
      serviceName: this.serviceName,
      stdio: "pipe",
      env: {
        ...process.env,
        ...this.env
      }
    });

    this.registerChildEvents(this.child);
    await this.sendStartAndWaitReady(this.child, signal);
  }

  override stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopped = true;
    this.startController?.abort(new Error(`${this.serviceName} start cancelled`));
    this.stopPromise = this.stopChild().finally(() => {
      this.stopping = false;
    });
    return this.stopPromise;
  }

  private async stopChild() {
    const child = this.child;
    if (!child) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.off("exit", finish);
        resolve();
      };
      const forceKill = () => {
        try {
          child.kill();
        } catch (error) {
          this.logger("error", error);
        } finally {
          finish();
        }
      };
      const timer = setTimeout(forceKill, this.stopTimeout);
      child.once("exit", finish);
      try {
        child.postMessage(this.buildStopMessage());
      } catch (error) {
        this.logger("error", error);
        forceKill();
      }
    });
    if (this.child === child) this.child = undefined;
    await this.afterStop();
  }

  private registerChildEvents(child: UtilityProcess) {
    const ok1 = Log.currentLevel <= LogLevel.DEBUG;
    const ok2 = Log.currentLevel <= LogLevel.ERROR;
    child.stdout?.on("data", (data) => {
      ok1 && this.logger("debug", data.toString().trim());
    });
    child.stderr?.on("data", (data) => {
      ok2 && this.logger("error", data.toString().trim());
    });
    child.on("error", (err) => {
      if (!this.starting) this.logger("error", err);
    });
    child.on("message", (message: ChildMessage) => {
      switch (message.type) {
        case "ready": {
          this.logger(
            "debug",
            "ready",
            Log.JsonCompact(Log.JsonFlat(Log.Exclude(message, ["type"])))
          );
          break;
        }
        case "stopped": {
          this.logger(
            "debug",
            "stopped",
            Log.JsonCompact(Log.JsonFlat(Log.Exclude(message, ["type"])))
          );
          break;
        }
        case "error": {
          if (this.stopped || (this.starting && !this.readyReceived)) break;
          const serializedError = (<ErrorMessage>message).error;
          const error = new Error(serializedError.message);
          error.name = serializedError.name ?? error.name;
          error.stack = serializedError.stack;
          if (serializedError.name === "panic" && !this.stopping) {
            this.panic(error);
          } else {
            this.logger("error", error);
          }
          break;
        }
        default:
          this.handleChildMessage(message as Exclude<ChildMessage, ResultMessage>);
          break;
      }
    });
    child.on("exit", (code) => {
      if (this.child !== child) return;
      const wasStopping = this.stopping;
      this.child = undefined;
      if (!wasStopping && !this.stopped && (!this.starting || this.readyReceived) && code !== 0) {
        this.panic(new Error(`${this.serviceName} exited unexpectedly: ${code}`));
      }
    });
  }

  private sendStartAndWaitReady(child: UtilityProcess, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        child.off("message", onMessage);
        child.off("error", onError);
        child.off("exit", onExit);
        signal.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve();
      };
      const onError = (type: "FatalError", location: string) =>
        finish(new Error(`${this.serviceName} ${type} at ${location}`));
      const onExit = (code: number) =>
        finish(new Error(`${this.serviceName} exited before ready: ${code}`));
      const onAbort = () => finish(signal.reason);
      const onMessage = (message: ChildMessage) => {
        if (message.type === "ready") {
          this.readyReceived = true;
          finish();
          return;
        }
        if (message.type === "error") {
          const serializedError = (message as ErrorMessage).error;
          const err = new Error(serializedError.message);
          err.name = serializedError.name ?? err.name;
          err.stack = serializedError.stack;
          finish(err);
        }
      };
      child.on("message", onMessage);
      child.once("error", onError);
      child.once("exit", onExit);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) return onAbort();
      try {
        child.postMessage(this.buildStartMessage());
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  protected async beforeStart() {}

  protected async afterStop() {}

  protected abstract buildStartMessage(): Extract<ParentMessage, StartMessage>;

  protected abstract buildStopMessage(): Extract<ParentMessage, StopMessage>;

  protected abstract handleChildMessage(message: Exclude<ChildMessage, ResultMessage>): void;
}
