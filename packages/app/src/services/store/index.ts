import { MainServicesInstance, type MainServicesType } from "@/types/service";
import Store from "@mahiru/store";

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
