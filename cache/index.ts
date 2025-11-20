import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { spawn } from "child_process";
import { ChildProcessByStdio } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "server.exe" : "server";
const applicationPath = join(__dirname, exeName);

let serverProc: ChildProcessByStdio<any, any, any> | null = null;
let enableConsole = true;

export function enableServerConsole(enable: boolean) {
  enableConsole = enable;
}

export function startServer(args: string[] = []) {
  if (serverProc) return serverProc.pid!;
  if (!existsSync(applicationPath)) throw new Error(`Executable not found: ${applicationPath}`);
  serverProc = spawn(applicationPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  if (!serverProc) throw new Error("Failed to start server process.");
  enableConsole &&
    serverProc.stdout.on("data", (b: any) => console.log("[server stdout]", b.toString()));
  enableConsole &&
    serverProc.stderr.on("data", (b: any) => console.error("[server stderr]", b.toString()));
  serverProc.on("exit", (code) => {
    console.log("server exited", code);
    serverProc = null;
  });
  return serverProc.pid!;
}

export function stopServer() {
  if (!serverProc) return false;
  serverProc.kill();
  return true;
}

export function isRunning() {
  return !!serverProc;
}

export function getPID() {
  return serverProc?.pid;
}
