import { resolve, relative, isAbsolute } from "node:path";

export function isSubPath(parent: string, child: string) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);

  const rel = relative(parentPath, childPath);

  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
