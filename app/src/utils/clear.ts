import { app, session } from "electron";
import { Log } from "./log";

export function clearAllCache() {
  app.on("ready", async () => {
    const ses = session.defaultSession;
    // 1. 清除各种存储
    await ses.clearStorageData({
      storages: [
        "cachestorage",
        "cookies",
        "filesystem",
        "indexdb",
        "localstorage",
        "serviceworkers",
        "shadercache",
        "websql"
      ],
      quotas: ["temporary"]
    });
    // 2. 清除 HTTP/HTTPS 缓存
    await ses.clearCache();
    // 3. 刷新写入
    ses.flushStorageData();
    Log.debug("Cache cleared");
  });
}
