import { Renderer } from "@mahiru/ui/public/entry/renderer";

export class NetClass {
  async checkOnline(): Promise<NetworkStatus> {
    if (!window.navigator.onLine) {
      return "offline";
    }

    return await Renderer.invoke.checkOnlineStatus();
  }

  addNetworkChangeListener(callback: (online: boolean) => void) {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }
}

export const Net = new NetClass();
