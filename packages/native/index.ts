import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface TaskbarNativeAddon {
  setCover(handle: Buffer, image: Uint8Array | null, preview?: Uint8Array | null): void;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const defaultAddonPath = join(__dirname, "index.node");
const require = createRequire(import.meta.url);

export function loadNativeTaskbarAddon(addonPath = defaultAddonPath): TaskbarNativeAddon {
  if (!existsSync(addonPath)) {
    throw new Error(`Native addon not built: ${addonPath}`);
  }

  return require(addonPath) as TaskbarNativeAddon;
}

export function setCover(
  handle: Buffer,
  image: Uint8Array | null,
  preview?: Uint8Array | null
): void {
  loadNativeTaskbarAddon().setCover(handle, image, preview);
}
