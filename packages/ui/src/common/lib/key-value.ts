import { RendererIPC } from "@/common/lib/ipc";
import { Log } from "@/common/lib/log";

export class RendererKeyValue {
  getItem<T extends JsonValue>(key: string, initialValue?: T): Promise<Undefinable<T>> {
    return RendererIPC.Invoke("getKeyValue", key).then((res) => {
      if (res.ok) return (res.value as T) ?? initialValue;
      else if (!res.ok) {
        res.reason && Log.error("RendererKeyValue.get", res.reason);
      }
      return initialValue;
    });
  }

  removeItem(key: string) {
    return RendererIPC.Invoke("deleteKeyValue", key).then((res) => {
      if (!res.ok && res.reason) Log.error("RendererKeyValue.remove", res.reason);
      return res.ok;
    });
  }

  setItem(key: string, value: JsonValue) {
    return RendererIPC.Invoke("setKeyValue", { key, value }).then((res) => {
      if (!res.ok && res.reason) Log.error("RendererKeyValue.set", res.reason);
      return res.ok;
    });
  }
}
