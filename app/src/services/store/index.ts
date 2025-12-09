import { enableServerConsole, getPID, isRunning, startServer, stopServer } from "@mahiru/store";
import { isDev } from "../../utils/dev";

export function startCacheServer(args: string[] = []) {
  if (isRunning()) {
    return getPID()!;
  }
  enableServerConsole(isDev());
  return startServer([
    "--port",
    process.env.GO_SERVER_PORT!,
    "--scheme",
    process.env.APP_SCHEME!,
    ...args
  ]);
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
