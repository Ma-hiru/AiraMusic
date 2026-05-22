import AppEnv from "../../../../scripts/env";
import { join } from "node:path";

AppEnv.setEnvPath(join(process.cwd(), "../../"), join(process.cwd(), "../../"));
const env = AppEnv.load("test");

describe("test vitest env loaded successfully", () => {
  const satisfyEnv = (target: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(env)) {
      expect(target[key]).toBe(String(value));
    }
  };
  it("should be load env to process.env", () => satisfyEnv(process.env));
});
