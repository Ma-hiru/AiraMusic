import Store from "@mahiru/store";

export default class StoreService {
  instance;

  constructor(props: Parameters<typeof Store.run>[0]) {
    this.instance = Store.run(props);
  }

  async stop() {
    if (process.platform === "win32") await this.instance.stopByHttp();
    await this.instance.stop();
  }
}
