import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { AppEnv } from "../../../../scripts/env";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const _root = join(__dirname, "../../");

AppEnv.setEnvPath(join(_root, "../../"), join(_root, "../../"));
const env = AppEnv.load("test");

describe("test vitest env loaded successfully", () => {
  const satisfyEnv = (target: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(env)) {
      expect(target[key]).toBe(String(value));
    }
  };
  it("should be load env to process.env", () => satisfyEnv(process.env));
});
