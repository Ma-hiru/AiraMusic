export type MainServicesName = "ncm" | "agent" | "proxy" | "store";

export abstract class MainServicesInstance {
  readonly name: MainServicesName;
  protected readonly panic: NormalFunc<[err: Error]>;
  protected readonly logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;

  protected constructor(props: {
    name: MainServicesName;
    onPanic: NormalFunc<[err: Error]>;
    logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
  }) {
    this.name = props.name;
    this.logger = props.logger;
    this.panic = props.onPanic;
  }

  abstract stop(): Promise<void>;
  abstract ready(): Promise<void>;
}
