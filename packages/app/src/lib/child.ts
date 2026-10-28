import type { MainServicesName } from "@/types/service";
import type {
  Message,
  ParentPort,
  ErrorMessage,
  ReadyMessage,
  StartMessage,
  ResultMessage,
  ControlMessage,
  StoppedMessage,
  SerializedError
} from "@/types/child";

export abstract class MainChild<
  ParentMessage extends Message | ControlMessage,
  ChildMessage extends Message | ResultMessage,
  StartedInfo = unknown,
  StopInfo = unknown
> {
  protected readonly parentPort: ParentPort<ParentMessage, ChildMessage>;
  protected readonly name: string;
  private starting = false;
  private stopping = false;

  protected constructor(name: MainServicesName) {
    if (!process.parentPort) {
      // 这里不传递error，因为如果不存在process.parentPort，首先就无法传递，其次说明不在electron启动，更没必要传递error
      throw new Error(`${name} child must be started by electron.utilityProcess.fork`);
    }
    this.name = name;
    this.parentPort = process.parentPort;
    this.init();
  }

  private init() {
    this.parentPort.on("message", (event) => this.handleParentCtlMessage(event.data));
    process.on("SIGTERM", () => this._stop(0));
    process.on("SIGINT", () => this._stop(0));
    process.on("uncaughtException", (err) => {
      this.sendPanicError(err);
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      this.sendPanicError(reason);
      process.exit(1);
    });
  }

  private async _start(message: ParentMessage) {
    if (this.starting) return;
    this.starting = true;
    try {
      const info = await this.start(message as Extract<ParentMessage, StartMessage>);
      this.send(this.buildReadyMessage(info));
    } catch (err) {
      this.sendPanicError(err);
    } finally {
      this.starting = false;
    }
  }

  private async _stop(exitCode?: number) {
    if (this.stopping) return;
    this.stopping = true;

    try {
      const info = await this.stop();
      this.send(this.buildStoppedMessage(info));
      if (typeof exitCode === "number") process.exit(exitCode);
    } catch (err) {
      this.sendPanicError(err);
      if (typeof exitCode === "number") process.exit(1);
    } finally {
      this.stopping = false;
    }
  }

  private async handleParentCtlMessage(message: ParentMessage) {
    switch (message.type) {
      case "start":
        await this._start(message);
        break;
      case "stop":
        await this._stop(0);
        break;
      default:
        await this.handleParentMessage(message as Exclude<ParentMessage, ControlMessage>);
        break;
    }
  }

  protected send(message: ChildMessage) {
    this.parentPort.postMessage(message);
  }

  /** Ready 之前的 Error 在Entry会被转换 panicError */
  protected sendError(err: unknown) {
    this.send(
      this.buildErrorMessage(
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : { message: String(err) }
      )
    );
  }

  protected sendPanicError(err: unknown) {
    this.send(
      this.buildErrorMessage(
        err instanceof Error
          ? { name: "panic", message: err.message, stack: err.stack }
          : { name: "panic", message: String(err) }
      )
    );
  }

  protected abstract handleParentMessage(
    message: Exclude<ParentMessage, ControlMessage>
  ): void | Promise<void>;
  protected abstract buildStoppedMessage(
    info: Awaited<StopInfo>
  ): Extract<ChildMessage, StoppedMessage>;
  protected abstract buildReadyMessage(
    info: Awaited<StartedInfo>
  ): Extract<ChildMessage, ReadyMessage>;
  protected abstract buildErrorMessage(error: SerializedError): Extract<ChildMessage, ErrorMessage>;
  protected abstract start(message: Extract<ParentMessage, StartMessage>): StartedInfo;
  protected abstract stop(): StopInfo;
}
