import { startServer, stopServer, isRunning, getPID } from "@mahiru/cache";

export function startCacheServer(args: string[] = []) {
  if (isRunning()) {
    return getPID()!;
  }
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
