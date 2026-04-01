import {
  enableServerConsole,
  getPID,
  isRunning,
  setServerPath,
  startServer,
  stopServer
} from "@mahiru/store";
import { isDev } from "../../utils/dev";
import { Log } from "../../utils/log";

type Props = {
  args?: Record<string, string | number>;
  log?: boolean;
  logger?: NormalFunc<[msg: Buffer]>;
  exitHandler?: Nullable<NormalFunc<[code: Nullable<number>]>>;
  path?: string;
};

let _cachedProps: Nullable<Props> = null;
let hasStopped = false;

export function startStoreServer(props?: Optional<Props>) {
  const { args = {}, log = isDev, logger, exitHandler, path } = props || {};
  if (isRunning()) return getPID()!;
  if (path) setServerPath(path);
  enableServerConsole(log);

  _cachedProps = { ...props, args, log };
  return startServer(
    [
      ...Object.entries(args)
        .map(([flag, value]) => [flag.startsWith("--") ? flag : "--" + flag, String(value)])
        .flat()
    ],
    logger,
    exitHandler
  );
}

export function stopStoreServer(): boolean {
  Log.debug("Stopping store server...");
  if (isRunning()) {
    hasStopped = true;
    return stopServer();
  }
  return true;
}

export function isStoreServerRunning(): boolean {
  return isRunning();
}

export function restartStoreServer(force = false) {
  if (hasStopped && !force) return;
  if (stopStoreServer()) {
    startStoreServer(_cachedProps);
  } else {
    throw new Error("failed to close store server");
  }
}
