import { MainServicesInstance } from "@/types/service";
import Store from "@mahiru/store";

export default class StoreService extends MainServicesInstance {
  instance: Store;
  private stopping = false;
  private stopPromise?: Promise<void>;

  constructor(
    props: Omit<Parameters<typeof Store.run>[0], "logger" | "onExit"> & {
      onPanicError: NormalFunc<[err: Error]>;
      logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
    }
  ) {
    super({ name: "store", onPanic: props.onPanicError, logger: props.logger });
    this.instance = Store.run({
      ...props,
      onExit: (code) => {
        if (this.stopping) {
          this.logger("debug", `store service exit with code ${code}`);
        } else {
          this.panic(new Error(`store service exit with code ${code}`));
        }
      },
      logger: (buffer) => {
        this.logger("debug", buffer.toString());
      }
    });
  }

  override stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopPromise = (async () => {
      if (process.platform === "win32") await this.instance.stopByHttp();
      await this.instance.stop();
    })().catch((error: unknown) => {
      this.stopping = false;
      this.stopPromise = undefined;
      throw error;
    });
    return this.stopPromise;
  }

  override async ready() {
    return new Promise<void>((resolve) => {
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelay = 500; // ms
      const checkServer = () => {
        this.instance.ping().then((ok) => {
          if (ok) {
            resolve();
          } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(checkServer, retryDelay);
          } else {
            console.warn("StoreService: Server did not respond to ping after multiple attempts.");
            resolve();
          }
        });
      };
      checkServer();
    });
  }
}
