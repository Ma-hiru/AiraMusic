import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";

export class RendererKeyValue {
  getItem<T extends JsonValue>(key: string, initialValue?: T): Promise<Undefinable<T>> {
    return RendererIPC.NormalChannel.send("invoke_store_get", key).then((res) => {
      if (res.ok) return (res.value as T) ?? initialValue;
      else if (!res.ok) {
        res.reason && Log.error("RendererKeyValue.get", res.reason);
      }
      return initialValue;
    });
  }

  removeItem(key: string) {
    return RendererIPC.NormalChannel.send("invoke_store_delete", key).then((res) => {
      if (!res.ok && res.reason) Log.error("RendererKeyValue.remove", res.reason);
      return res.ok;
    });
  }

  setItem(key: string, value: JsonValue) {
    return RendererIPC.NormalChannel.send("invoke_store_set", { key, value }).then((res) => {
      if (!res.ok && res.reason) Log.error("RendererKeyValue.set", res.reason);
      return res.ok;
    });
  }
}
