import { app, utilityProcess, type UtilityProcess } from "electron";
import { fileURLToPath } from "node:url";
import { Log } from "@/lib/log";

export type MainChildEntryOptions = {
  serviceName: string;
  childPath: string;
  metaUrl: string;
  env?: NodeJS.ProcessEnv;
  autoStart?: boolean;
  stopTimeout?: number;
  onError: NormalFunc<[err: Error]>;
};

export abstract class MainChildEntry<
  ParentMessage extends { type: "start" | "stop" },
  ChildMessage extends { type: string }
> {
  readonly childPath: string;
  readonly serviceName: string;
  readonly onError: NormalFunc<[err: Error]>;
  readonly stopTimeout: number;
  readonly env?: NodeJS.ProcessEnv;

  protected child?: UtilityProcess;
  protected starting = false;
  protected startPromise?: Promise<void>;
  protected stopping = false;

  constructor(options: MainChildEntryOptions) {
    this.serviceName = options.serviceName;
    this.childPath = fileURLToPath(new URL(options.childPath, options.metaUrl));
    this.onError = options.onError;
    this.stopTimeout = options.stopTimeout ?? 2000;
    this.env = options.env;

    if (options.autoStart ?? true) {
      this.startPromise = this.start();
    }
  }

  async ready() {
    await this.startPromise;
  }

  async start() {
    if (this.child || this.stopping || this.starting) return;
    this.starting = true;
    await app.whenReady();
    await this.beforeStart();

    this.child = utilityProcess.fork(this.childPath, [], {
      serviceName: this.serviceName,
      stdio: "pipe",
      env: {
        ...process.env,
        ...this.env
      }
    });

    this.registerChildEvents();
    await this.sendStartAndWaitReady();
    this.starting = false;
  }

  async stop() {
    const child = this.child;
    if (!child) return;

    if (this.stopping) return;
    this.stopping = true;

    child.postMessage(this.createStopMessage());
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, this.stopTimeout);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.child = undefined;
    await this.afterStop();

    this.stopping = false;
  }

  private registerChildEvents() {
    this.child?.stdout?.on("data", (data) => {
      this.printInfo(data.toString().trim());
    });

    this.child?.stderr?.on("data", (data) => {
      this.printError(data.toString().trim());
    });

    this.child?.on("error", (err) => {
      this.printError(err);
    });

    this.child?.on("exit", (code) => {
      const wasStopping = this.stopping;
      this.child = undefined;
      if (!wasStopping) {
        this.onError(new Error(`${this.serviceName} exited unexpectedly: ${code}`));
      }
    });

    this.child?.on("message", (message: ChildMessage) => {
      this.handleChildMessage(message);
    });
  }

  private async sendStartAndWaitReady() {
    await new Promise<void>((resolve, reject) => {
      const onMessage = (message: ChildMessage) => {
        if (this.isReadyMessage(message)) {
          this.child?.off("message", onMessage);
          resolve();
          return;
        }
        if (this.isErrorMessage(message)) {
          this.child?.off("message", onMessage);
          reject(this.getErrorFromMessage(message));
        }
      };
      this.child?.on("message", onMessage);
      this.child?.postMessage(this.createStartMessage());
    }).catch((err) => {
      this.onError(new Error(`${this.serviceName} start failed: ${err}`));
    });
  }

  protected printInfo(...message: any[]) {
    Log.debug(`MainService(${this.serviceName})`, ...message);
  }

  protected printError(...message: any[]) {
    Log.error(`MainService(${this.serviceName})`, ...message);
  }

  protected async beforeStart() {}

  protected async afterStop() {}

  protected abstract createStartMessage(): ParentMessage;

  protected abstract createStopMessage(): ParentMessage;

  protected abstract isReadyMessage(message: ChildMessage): boolean;

  protected abstract isErrorMessage(message: ChildMessage): boolean;

  protected abstract getErrorFromMessage(message: ChildMessage): Error;

  protected abstract handleChildMessage(message: ChildMessage): void;
}

export type MainChildParentPort<
  ParentMessage extends { type: string },
  ChildMessage extends { type: string }
> = {
  on(
    event: "message",
    listener: (event: { data: ParentMessage }) => void
  ): MainChildParentPort<ParentMessage, ChildMessage>;

  postMessage(message: ChildMessage): void;
};

// todo
export abstract class MainChild<
  ParentMessage extends { type: "start" | "stop" },
  ChildMessage extends { type: string }
> {
  protected readonly parentPort: MainChildParentPort<ParentMessage, ChildMessage>;
  protected name;
  protected starting = false;
  protected stopping = false;

  protected constructor(name: string) {
    this.name = name;
    const parentPort = process.parentPort;
    if (!parentPort) {
      throw new Error(`${this.name} child must be started by electron.utilityProcess.fork`);
    }

    this.parentPort = parentPort;
    this.register();
  }

  protected register() {
    this.parentPort.on("message", (event) => {
      void this.handleMessage(event.data);
    });

    process.on("uncaughtException", (err) => {
      this.sendError(err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      this.sendError(reason);
      process.exit(1);
    });

    process.on("SIGTERM", () => {
      void this.stop(0);
    });

    process.on("SIGINT", () => {
      void this.stop(0);
    });
  }

  protected async handleMessage(message: ParentMessage) {
    switch (message.type) {
      case "start":
        if (this.starting) return;
        this.starting = true;
        try {
          await this.start(message);
        } catch (err) {
          this.sendError(err);
        } finally {
          this.starting = false;
        }
        break;
      case "stop":
        await this.stop(0);
        break;
      default:
        await this.handleCustomMessage(message);
        break;
    }
  }

  protected abstract start(message: ParentMessage): Promise<void> | void;

  protected abstract close(): Promise<void> | void;

  protected async stop(exitCode?: number) {
    if (this.stopping) return;
    this.stopping = true;

    try {
      await this.close();
      this.send(this.createStoppedMessage());
      if (typeof exitCode === "number") process.exit(exitCode);
    } catch (err) {
      this.sendError(err);
      if (typeof exitCode === "number") process.exit(1);
    } finally {
      this.stopping = false;
    }
  }

  protected abstract handleCustomMessage(message: ParentMessage): Promise<void>;

  protected abstract createStoppedMessage(): ChildMessage;

  protected abstract createErrorMessage(error: { message: string; stack?: string }): ChildMessage;

  protected send(message: ChildMessage) {
    this.parentPort.postMessage(message);
  }

  protected sendError(err: unknown) {
    this.send(this.createErrorMessage(this.serializeError(err)));
  }

  protected serializeError(err: unknown) {
    if (err instanceof Error) {
      return {
        message: err.message,
        stack: err.stack
      };
    }

    return {
      message: String(err)
    };
  }
}
