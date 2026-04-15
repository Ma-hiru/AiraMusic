import { Log } from "@mahiru/ui/public/utils/dev";
import _AppRenderer from "@mahiru/ui/public/source/electron/services/renderer";

export default class _AppNet {
  static completed: number[] = [];
  static cursor = 0;

  static init() {
    const observer = new PerformanceObserver((list) => {
      const now = performance.now();
      list.getEntries().forEach(() => {
        this.completed.push(now);
      });
      if (this.completed.length > 5000) {
        this.completed = this.completed.slice(this.cursor);
        this.cursor = 0;
      }
    });
    observer.observe({
      entryTypes: ["resource"],
      buffered: false
    });
  }

  static getStatus() {
    const now = performance.now();
    while (this.cursor < this.completed.length && this.completed[this.cursor]! < now - 1000) {
      this.cursor++;
    }
    const recent = this.completed.length - this.cursor;
    const score = Math.min(1, recent / 12);
    Log.debug("Network quality", "score", score, "recent", recent);
    return {
      score,
      recent
    };
  }

  static async checkOnline(): Promise<NetworkStatus> {
    if (!window.navigator.onLine) {
      return "offline";
    }

    return await _AppRenderer.Event.invoke.checkOnlineStatus();
  }

  static addNetworkChangeListener(callback: (online: boolean) => void) {
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

window.requestAnimationFrame(() => {
  _AppNet.init();
});
