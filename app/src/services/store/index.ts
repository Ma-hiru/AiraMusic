import Store from "@mahiru/store";

export default class StoreService {
  static create(
    props: Omit<Parameters<typeof Store.run>[0], "args"> & { args: Record<string, string | number> }
  ) {
    return Store.run({
      ...props,
      args: Object.entries(props.args)
        .map(([flag, value]) => [flag.startsWith("--") ? flag : `--${flag}`, String(value)])
        .flat()
    });
  }
}
