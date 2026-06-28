const ArgValueCache = new Map<string, Undefinable<string>>();
const ArgFlagCache = new Map<string, boolean>();

export function getArgValue(name: string): Undefinable<string> {
  if (ArgValueCache.has(name)) return ArgValueCache.get(name);

  const prefix = `--${name}=`;

  const withEqual = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEqual) {
    const value = withEqual.slice(prefix.length);
    ArgValueCache.set(name, value);
    return value;
  }

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index !== -1) {
    const value = process.argv[index + 1];
    if (value && !value.startsWith("--")) {
      ArgValueCache.set(name, value);
      return value;
    }
  }

  ArgValueCache.set(name, undefined);
  return undefined;
}

export function getArgFlag(name: string): boolean {
  if (ArgFlagCache.has(name)) return ArgFlagCache.get(name) ?? false;
  const value = process.argv.includes(`--${name}`);
  ArgFlagCache.set(name, value);
  return value;
}
