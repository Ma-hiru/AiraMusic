import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import type { NativeAddon } from "./api";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const defaultAddonPath = join(__dirname, "index.node");

const loadNativeAddon = (addonPath = defaultAddonPath): NativeAddon => {
  if (!existsSync(addonPath)) {
    throw new Error(`Native addon not built: ${addonPath}`);
  }

  return require(addonPath) as NativeAddon;
};

export type { NativeAddon } from "./api";
export { loadNativeAddon };
