import { Log } from "./log";
import { getScreenInfo } from "./screen";
import { app, Display, screen } from "electron";
import { randomUUID } from "node:crypto";

export const storeKeyAccessToken = `mahiru-access-token-${randomUUID()}`;

export const isDev = process.env.APP_MODE.toLowerCase().includes("dev");

export function printDevInfo() {
  app.on("ready", () => {
    const displays = getScreenInfo();
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
      displays.map(formatDisplay).join("\n"),
      "========================================================="
    );
  });
}

function formatDisplay(display: Display) {
  return `
   Display of ${display.id}
     Info:
           Primary: ${screen.getPrimaryDisplay().id === display.id ? "Yes" : "No"}
           Internal: ${display.internal ? "Yes" : "No"}
           Position: (${display.bounds.x}, ${display.bounds.y})
           Rotation: ${display.rotation}°
           Scale Factor: ${display.scaleFactor}
           Size: ${display.size.width}@${display.size.height}
           Touch Support: ${display.touchSupport}
     Bounds:
           X:      ${display.bounds.x}
           Y:      ${display.bounds.y}
           Width:  ${display.bounds.width}
           Height: ${display.bounds.height}
     Work Area:
           X:      ${display.workArea.x}
           Y:      ${display.workArea.y}
           Width:  ${display.workArea.width}
           Height: ${display.workArea.height}
     Work Area Size:
           Width:  ${display.workAreaSize.width}
           Height: ${display.workAreaSize.height}
     Color Properties:
           Color Depth: ${display.colorDepth}
           Color Space: ${display.colorSpace}
  `;
}
