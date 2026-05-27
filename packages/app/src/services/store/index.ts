import Store from "@mahiru/store";
import { MainServicesInstance, type MainServicesType } from "@/types/service";

export default class StoreService extends MainServicesInstance {
  instance;
  serviceName;

  constructor(props: Parameters<typeof Store.run>[0] & { serviceName: MainServicesType }) {
    super();
    this.serviceName = props.serviceName;
    this.instance = Store.run(props);
  }

  override name(): MainServicesType {
    return this.serviceName;
  }

  override async stop() {
    if (process.platform === "win32") await this.instance.stopByHttp();
    await this.instance.stop();
  }
}
