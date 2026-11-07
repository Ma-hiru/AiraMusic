import { hostname } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const exec = promisify(execFile);

export async function getDeviceName(): Promise<string> {
  const fallback = hostname().replace(/\.local$/, "");

  try {
    switch (process.platform) {
      case "darwin": {
        const { stdout } = await exec("/usr/sbin/scutil", ["--get", "ComputerName"]);
        return stdout.trim() || fallback;
      }

      case "linux": {
        const { stdout } = await exec("hostnamectl", ["--pretty"]);
        return stdout.trim() || fallback;
      }

      case "win32":
      default:
        return fallback;
    }
  } catch {
    return fallback;
  }
}
