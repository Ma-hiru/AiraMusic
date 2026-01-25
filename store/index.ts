import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ChildProcessByStdio, spawn } from "node:child_process";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "server.exe" : "server";
let applicationPath = join(__dirname, exeName);

// ["ignore","pipe","pipe"]
let serverProc: Nullable<
  ChildProcessByStdio<null, Readable, Readable> | ChildProcessByStdio<null, null, null>
> = null;
let enableConsole = true;

export function setServerPath(path: string) {
  applicationPath = path;
}

export function enableServerConsole(enable: boolean) {
  enableConsole = enable;
}

export function startServer(
  args: string[] = [],
  logger: NormalFunc<[msg: Buffer]> = (b: Buffer) => console.log("[server stdout]", b.toString()),
  exitHandler: Nullable<NormalFunc<[code: Nullable<number>]>> = null
) {
  if (serverProc) {
    return serverProc.pid!;
  } else if (!existsSync(applicationPath)) {
    throw new Error(`executable not found: ${applicationPath}`);
  }
  if (enableConsole) {
    serverProc = spawn(applicationPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
  } else {
    serverProc = spawn(applicationPath, args, {
      stdio: ["ignore", "ignore", "ignore"]
    });
  }
  if (!serverProc) {
    throw new Error("failed to start server process.");
  }
  if (enableConsole && serverProc?.stdout) {
    serverProc.stdout.on("data", logger);
    serverProc.stderr.on("data", logger);
  }

  serverProc.on("exit", (code) => {
    !logger && console.log("server exited", code);
    logger?.(Buffer.from("server exited: " + code));
    exitHandler?.(code);
    serverProc?.kill("SIGTERM");
    serverProc = null;
  });

  return serverProc.pid!;
}

export function stopServer() {
  if (!serverProc) return true;
  return serverProc.kill("SIGTERM");
}

export function isRunning() {
  return !!serverProc;
}

export function getPID() {
  return serverProc?.pid;
}
