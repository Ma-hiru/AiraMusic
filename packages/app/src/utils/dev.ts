import { Log } from "./log";
import { app } from "electron";
import { randomUUID } from "node:crypto";
import AppScreen from "./screen";

export const storeKeyAccessToken = `${process.env.APP_NAME}-access-token-${randomUUID()}`;

export const runtimeID = `${process.env.APP_NAME}-runtime-${randomUUID()}`;

export const isDev = process.env.APP_MODE.toLowerCase().includes("dev");

export function printDevInfo() {
  app.on("ready", () => {
    const displays = AppScreen.getAllScreens();
    Log.debug(
      "app/dev.ts:printDevInfo",
      "\n",
      "===================== App Dev Info =====================\n",
      `Environment: ${isDev ? "Development" : "Production"}\n`,
      `Platform: ${process.platform}\n`,
      `Electron Version: ${process.versions.electron}\n`,
      `Node.js Version: ${process.versions.node}\n`,
      `V8 Version: ${process.versions.v8}\n`,
      `Chrome Version: ${process.versions.chrome}\n`,
      `Screen Count: ${displays.length}\n`,
      `Displays:`,
      displays.map(String).join("\n"),
      "========================================================="
    );
  });
}
