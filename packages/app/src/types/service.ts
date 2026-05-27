export type MainServicesType = "store" | "ncm" | "proxy";

export abstract class MainServicesInstance {
  abstract stop(): Promise<void>;
  abstract name(): MainServicesType;
}
