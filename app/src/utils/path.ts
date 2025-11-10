import { join } from "node:path";
import { app } from "electron";


export function appPathJoin(...paths: string[]): string {
  return join(app.getAppPath(), ...paths);
}
