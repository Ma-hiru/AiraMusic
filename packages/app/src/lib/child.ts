import type {
  MainChildControlMessage,
  MainChildParentPort,
  MainChildSerializedError,
  MainChildStartMessage
} from "@/types/child";
import { type MainServicesType } from "@/types/service";

export abstract class MainChild<
  ParentMessage extends { type: string },
  ChildMessage extends { type: string }
> {
  protected readonly parentPort: MainChildParentPort<ParentMessage, ChildMessage>;
  protected readonly name: string;
  protected starting = false;
  protected stopping = false;

  protected constructor(name: MainServicesType) {
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
          await this.start(message as Extract<ParentMessage, MainChildStartMessage>);
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
        await this.handleCustomMessage(message as Exclude<ParentMessage, MainChildControlMessage>);
        break;
    }
  }

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

  protected send(message: ChildMessage) {
    this.parentPort.postMessage(message);
  }

  protected sendError(err: unknown) {
    this.send(this.createErrorMessage(this.serializeError(err)));
  }

  protected serializeError(err: unknown): MainChildSerializedError {
    if (err instanceof Error) return { message: err.message, stack: err.stack };
    return { message: String(err) };
  }

  protected abstract handleCustomMessage(
    message: Exclude<ParentMessage, MainChildControlMessage>
  ): Promise<void> | void;
  protected abstract start(
    message: Extract<ParentMessage, MainChildStartMessage>
  ): Promise<void> | void;
  protected abstract close(): Promise<void> | void;
  protected abstract createStoppedMessage(): ChildMessage;
  protected abstract createErrorMessage(error: MainChildSerializedError): ChildMessage;
}
