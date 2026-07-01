export type MainServicesType = "ncm" | "proxy" | "store";

export abstract class MainServicesInstance {
  abstract stop(): Promise<void>;
  abstract name(): MainServicesType;
  abstract ready(): Promise<void>;
}
