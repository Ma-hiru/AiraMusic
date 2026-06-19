import { Log } from "@/common/lib/log";
import { init } from "@mahiru/ipc/renderer";

export function ipcInit() {
  queueMicrotask(() => init(Log));
}
