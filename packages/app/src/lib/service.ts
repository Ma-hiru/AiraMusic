import { Log } from "@/lib/log";
import type { MainServicesType, MainServicesInstance } from "@/types/service";

export type MainServicesCreator = NormalFunc<
  [ports: Record<MainServicesType, number>],
  MainServicesInstance
>;

export abstract class MainServicesBase {
  private readonly instances: Map<MainServicesType, Nullable<MainServicesInstance>> = new Map();
  private readonly readyPromise: Promise<void>;
  public readonly services: readonly MainServicesType[];
  public onError;

  getInstance(service: MainServicesType) {
    return this.instances.get(service);
  }

  ready() {
    return this.readyPromise;
  }

  protected constructor(props: {
    services: readonly MainServicesType[];
    onError: NormalFunc<[service: MainServicesType, msg: string, err?: unknown]>;
  }) {
    this.onError = props.onError;
    this.services = [...new Set(props.services)];
    const { promise, resolve } = Promise.withResolvers<void>();
    this.readyPromise = promise;
    this.resolvePort().then((ports) => {
      for (const service of this.services) {
        this.instances.set(
          service,
          this.wrapServiceCreator(service, this.creators[service])(ports)
        );
      }
      Promise.all(
        this.services.map((service) => {
          const instance = this.instances.get(service);
          if (!instance) return Promise.resolve();
          return instance.ready();
        })
      ).finally(resolve);
    });
  }

  protected printServiceLog(service: MainServicesType, msg: string) {
    Log.debug(`MainService(${service})`, msg);
  }

  private wrapServiceCreator(
    service: MainServicesType,
    creator: MainServicesCreator
  ): NormalFunc<Parameters<MainServicesCreator>, Nullable<MainServicesInstance>> {
    return (ports) => {
      try {
        const instance = creator(ports);
        this.printServiceLog(service, "service created");
        return instance;
      } catch (err) {
        this.onError(service, "service create error", err);
        return null;
      }
    };
  }

  private checkService(service: MainServicesType) {
    const started = this.services.includes(service);
    if (!started) return false;
    return !!this.instances.get(service);
  }

  public stopService(service: MainServicesType) {
    if (!this.checkService(service)) return Promise.resolve();
    return this.instances.get(service)!.stop();
  }

  protected abstract readonly creators: Record<MainServicesType, MainServicesCreator>;
  protected abstract resolvePort(): Promise<Record<MainServicesType, number>>;
}
