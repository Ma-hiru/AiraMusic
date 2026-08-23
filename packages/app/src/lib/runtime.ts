import { randomUUID } from "node:crypto";

export class MainRuntime {
  static readonly id = `${process.env.APP_NAME}-runtime-${randomUUID()}`;
  static readonly storeAccessToken = `${process.env.APP_NAME}-access-token-${randomUUID()}`;
  /** 仅用于 Electron 主进程调用 Rust Agent HTTP API。 */
  static readonly agentControlToken = `${process.env.APP_NAME}-agent-control-${randomUUID()}`;
  /** 仅用于 Rust Agent 调用应用内 MCP 的完整工具目录。 */
  static readonly agentMcpToken = `${process.env.APP_NAME}-agent-mcp-${randomUUID()}`;
  static isDev = process.env.APP_MODE.toLowerCase().includes("dev");
  static isTest = String(process.env.APP_TEST).toLowerCase() === "true";
  static get linuxDesktop() {
    if (process.platform !== "linux") return null;

    const env = (
      process.env["XDG_CURRENT_DESKTOP"] ||
      process.env["DESKTOP_SESSION"] ||
      process.env["GDMSESSION"] ||
      process.env["XDG_SESSION_DESKTOP"] ||
      ""
    ).toLowerCase();

    if (!env) return null;
    if (env.includes("gnome")) return "gnome";
    if (env.includes("kde") || env.includes("plasma")) return "kde";
    if (env.includes("xfce")) return "xfce";
    if (env.includes("cinnamon")) return "cinnamon";
    if (env.includes("mate")) return "mate";
    if (env.includes("lxde")) return "lxde";
    if (env.includes("lxqt")) return "lxqt";

    return null;
  }
}
