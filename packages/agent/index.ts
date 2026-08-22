import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exec_name = process.platform === "win32" ? "agent.exe" : "agent";
const default_exec_path = join(__dirname, exec_name);

export class Agent {
  constructor() {}

  static run(props: { exec_path: Nullable<string> }) {
    let { exec_path } = props;
    exec_path ??= default_exec_path;
  }
}
