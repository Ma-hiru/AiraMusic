import {
  enableServerConsole,
  getPID,
  isRunning,
  setServerPath,
  startServer,
  stopServer
} from "@mahiru/store";
import { isDev } from "../../utils/dev";

type Props = {
  args?: Record<string, string | number>;
  log?: boolean;
  logger?: NormalFunc<[msg: Buffer]>;
  exitHandler?: Nullable<NormalFunc<[code: Nullable<number>]>>;
  path?: string;
};

let _cachedProps: Nullable<Props> = null;

export function startStoreServer(props?: Optional<Props>) {
  const { args = {}, log = isDev(), logger, exitHandler, path } = props || {};
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
  if (isRunning()) {
    return stopServer();
  }
  return true;
}

export function isStoreServerRunning(): boolean {
  return isRunning();
}

export function restartStoreServer() {
  if (stopStoreServer()) {
    startStoreServer(_cachedProps);
  } else {
    throw new Error("failed to close store server");
  }
}
