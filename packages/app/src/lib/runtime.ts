import { randomUUID } from "node:crypto";

export class MainRuntime {
  static readonly id = `${process.env.APP_NAME}-runtime-${randomUUID()}`;
  static readonly storeAccessToken = `${process.env.APP_NAME}-access-token-${randomUUID()}`;
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
