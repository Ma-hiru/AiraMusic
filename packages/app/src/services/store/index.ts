import Store from "@mahiru/store";
import { Log } from "../../utils/log";

export default class StoreService {
  static create(
    props: Omit<Parameters<typeof Store.run>[0], "args"> & { args: Record<string, string | number> }
  ) {
    const instance = Store.run({
      ...props,
      args: Object.entries(props.args)
        .map(([flag, value]) => [flag.startsWith("--") ? flag : `--${flag}`, String(value)])
        .flat()
    });
    Log.debug("Store instance created, pid: " + instance.pid);
    return instance;
  }
}
