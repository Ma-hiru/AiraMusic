import { startServer, stopServer, isRunning, getPID, enableServerConsole } from "@mahiru/cache";
import { isDev } from "../../utils/dev";

export function startCacheServer(args: string[] = []) {
  if (isRunning()) {
    return getPID()!;
  }
  enableServerConsole(isDev());
  return startServer(args);
}

export function stopCacheServer(): boolean {
  if (isRunning()) {
    return stopServer();
  }
  return true;
}

export function isCacheServerRunning(): boolean {
  return isRunning();
}
