import { fileURLToPath } from "node:url";
import { app, utilityProcess, type UtilityProcess } from "electron";
import { Log } from "@/lib/log";
import { MainServicesInstance, type MainServicesType } from "@/types/service";

export type MainChildEntryOptions = {
  metaUrl: string;
  childPath: string;
  autoStart?: boolean;
  stopTimeout?: number;
  env?: NodeJS.ProcessEnv;
  serviceName: MainServicesType;
  onError: NormalFunc<[err: Error]>;
};

export abstract class MainChildEntry<
  ParentMessage extends { type: "stop" | "start" },
  ChildMessage extends { type: string }
> extends MainServicesInstance {
  readonly childPath: string;
  readonly serviceName: MainServicesType;
  readonly onError: NormalFunc<[err: Error]>;
  readonly stopTimeout: number;
  readonly env?: NodeJS.ProcessEnv;

  protected child?: UtilityProcess;
  protected starting = false;
  protected startPromise?: Promise<void>;
  protected stopping = false;

  protected constructor(options: MainChildEntryOptions) {
    super();
    this.serviceName = options.serviceName;
    this.childPath = fileURLToPath(new URL(options.childPath, options.metaUrl));
    this.onError = options.onError;
    this.stopTimeout = options.stopTimeout ?? 2000;
    this.env = options.env;

    if (options.autoStart ?? true) {
      this.startPromise = this.start();
    }
  }

  override name() {
    return this.serviceName;
  }

  override async ready() {
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

  override async stop() {
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
      if (!wasStopping && code !== 0) {
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
