import { Renderer } from "@mahiru/ui/utils/renderer";

export const Net = new (class {
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
})();
