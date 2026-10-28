import { Log, runWithLogContext } from "@/lib/log";
import type { MainServicesName, MainServicesInstance } from "@/types/service";

export type MainServicesCreator = NormalFunc<
  [ports: Record<MainServicesName, number>],
  MainServicesInstance
>;

export abstract class MainServicesBase {
  private readonly instances: Map<MainServicesName, Nullable<MainServicesInstance>> = new Map();
  private readonly readyPromise: Promise<void>;
  private readonly starting = new Map<MainServicesName, Promise<void>>();
  /** {@link startService} 使用的AbortController */
  private readonly startControllers = new Map<MainServicesName, AbortController>();
  private readonly stopping = new Map<MainServicesInstance, Promise<void>>();
  /** {@link stopAll} 使用的AbortController */
  private readonly shutdown = new AbortController();
  private stopPromise?: Promise<void>;
  /** {@link constructor} 和 {@link startService} 启动的服务 */
  private readonly serviceNames: MainServicesName[];
  /** constructor启动的服务 */
  public readonly services: readonly MainServicesName[];
  public readonly panic: NormalFunc<[service: MainServicesName, err: Error]>;

  getInstance(service: MainServicesName): Readonly<Nullable<MainServicesInstance>> {
    return this.instances.get(service) ?? null;
  }

  ready() {
    return this.readyPromise;
  }

  protected constructor(props: {
    services: readonly MainServicesName[];
    onPanic: NormalFunc<[service: MainServicesName, err: Error]>;
  }) {
    this.panic = (service: MainServicesName, err: Error) => {
      return runWithLogContext({ traceId: ["service", service] }, () =>
        props.onPanic(service, err)
      );
    };
    this.serviceNames = [...new Set(props.services)];
    this.services = this.serviceNames;
    this.readyPromise = this.initialize();
    void this.readyPromise.catch(() => undefined);
  }

  private async initialize() {
    const signal = this.shutdown.signal;
    let ports: Record<MainServicesName, number>;
    try {
      ports = await this.waitWithSignal(this.resolvePort(), signal);
    } catch (error) {
      if (!signal.aborted) {
        for (const service of this.services) this.panic(service, error as Error);
      }
      throw error;
    }
    signal.throwIfAborted();
    const instances = this.services.map((service) => {
      signal.throwIfAborted();
      const instance = this.wrapServiceCreator(service, this.creators[service])(ports);
      if (!instance) throw new Error(`${service} service create failed`);
      this.instances.set(service, instance);
      return instance;
    });
    await Promise.all(instances.map((instance) => this.waitUntilReady(instance, signal)));
  }

  protected logger(service: MainServicesName, level: "debug" | "error", ...msg: any[]) {
    runWithLogContext({ traceId: ["service", service] }, () =>
      // @ts-expect-error
      level === "debug" ? Log.debug(...msg) : Log.error(...msg)
    );
  }

  private wrapServiceCreator(
    service: MainServicesName,
    creator: MainServicesCreator
  ): NormalFunc<Parameters<MainServicesCreator>, Nullable<MainServicesInstance>> {
    return (ports) => {
      try {
        const instance = creator(ports);
        this.logger(service, "debug", "service created");
        return instance;
      } catch (err) {
        this.panic(service, new Error(Log.format("service create error", err)));
        return null;
      }
    };
  }

  private waitWithSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) {
      void operation.catch(() => undefined);
      return Promise.reject(signal.reason);
    }
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      operation.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
  }

  private async waitUntilReady(instance: MainServicesInstance, signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      await this.waitWithSignal(instance.ready(), signal);
    } catch (error) {
      void this.stopInstance(instance).catch((error: unknown) => {
        this.logger(instance.name, "error", "service cleanup error", error);
      });
      if (this.instances.get(instance.name) === instance) this.instances.delete(instance.name);
      if (!signal.aborted) {
        this.panic(instance.name, new Error(Log.format("service ready error", error)));
      }
      throw error;
    }
  }

  private stopInstance(instance: MainServicesInstance): Promise<void> {
    const pending = this.stopping.get(instance);
    if (pending) return pending;
    const operation = instance.stop().catch((error: unknown) => {
      this.stopping.delete(instance);
      throw error;
    });
    this.stopping.set(instance, operation);
    return operation;
  }

  stopService(service: MainServicesName): Promise<void> {
    this.startControllers.get(service)?.abort(new Error(`${service} service start cancelled`));
    const instance = this.instances.get(service);
    return instance ? this.stopInstance(instance) : Promise.resolve();
  }

  stopAll(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.shutdown.abort(new Error("Services stopped during startup"));
    for (const controller of this.startControllers.values()) {
      controller.abort(this.shutdown.signal.reason);
    }
    this.stopPromise = Promise.allSettled([
      ...this.stopping.values(),
      ...[...this.instances.values()]
        .filter((instance) => !!instance)
        .map((instance) => this.stopInstance(instance))
    ]).then(() => undefined);
    return this.stopPromise;
  }

  /** 依赖就绪后启动可选服务，同一个服务的并发启动共用一份 Promise */
  startService(service: MainServicesName): Promise<void> {
    const pending = this.starting.get(service);
    if (pending) return pending;
    const controller = new AbortController();
    const signal = AbortSignal.any([this.shutdown.signal, controller.signal]);
    this.startControllers.set(service, controller);
    const operation = this.waitWithSignal(this.readyPromise, signal)
      .then(async () => {
        signal.throwIfAborted();
        const existing = this.instances.get(service);
        if (existing) return this.waitWithSignal(existing.ready(), signal);
        const ports = await this.waitWithSignal(this.resolvePort(), signal);
        signal.throwIfAborted();
        const instance = this.wrapServiceCreator(service, this.creators[service])(ports);
        if (!instance) throw new Error(`${service} service create failed`);
        this.instances.set(service, instance);
        if (!this.serviceNames.includes(service)) this.serviceNames.push(service);
        await this.waitUntilReady(instance, signal);
      })
      .finally(() => {
        this.starting.delete(service);
        this.startControllers.delete(service);
      });
    this.starting.set(service, operation);
    return operation;
  }

  protected abstract readonly creators: Record<MainServicesName, MainServicesCreator>;
  protected abstract resolvePort(): Promise<Record<MainServicesName, number>>;
}
