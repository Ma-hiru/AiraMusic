import { vi, test, expect, describe } from "vitest";

import { createLog } from "../packages/log/src/log/create";
import { LogLevel } from "../packages/log/src/log/logLevel";

function createConsole() {
  const method = () =>
    vi.fn(function (this: unknown) {
      return this;
    });
  return {
    log: method(),
    info: method(),
    warn: method(),
    error: method(),
    trace: method(),
    debug: method(),
    group: method(),
    groupCollapsed: method(),
    groupEnd: method(),
    table: method()
  };
}

function withConsole(run: (raw: ReturnType<typeof createConsole>) => void) {
  const raw = createConsole();
  vi.stubGlobal("console", raw);
  vi.stubGlobal("raw_console", undefined);
  try {
    run(raw);
  } finally {
    vi.unstubAllGlobals();
  }
}

describe("global console logging", () => {
  test("keeps React's console muting and restoration separate from the original writer", () => {
    withConsole((raw) => {
      const logger = createLog("TRACE", raw);
      expect(logger.ReplaceGlobalConsole()).toBe(raw);
      const methods = [
        "info",
        "log",
        "warn",
        "error",
        "group",
        "groupCollapsed",
        "groupEnd"
      ] as const;
      const saved = Object.fromEntries(methods.map((method) => [method, console[method]]));
      const originalError = raw.error;
      const muted = vi.fn();
      // React's describeNativeComponentFrame saves, disables, and restores these methods.
      Object.defineProperties(
        console,
        Object.fromEntries(
          methods.map((method) => [
            method,
            { configurable: true, enumerable: true, writable: true, value: muted }
          ])
        )
      );
      expect(raw.error).toBe(originalError);
      console.error("muted error");
      expect(muted).toHaveBeenCalledExactlyOnceWith("muted error");
      expect(originalError).not.toHaveBeenCalled();
      Object.defineProperties(
        console,
        Object.fromEntries(
          methods.map((method) => [
            method,
            { configurable: true, enumerable: true, writable: true, value: saved[method] }
          ])
        )
      );
      expect(raw.error).toBe(originalError);
      logger.error("direct error");
      console.error("console error");
      expect(originalError).toHaveBeenCalledTimes(2);
      expect(originalError).toHaveBeenNthCalledWith(1, expect.stringContaining("direct error"));
      expect(originalError).toHaveBeenNthCalledWith(2, expect.stringContaining("console error"));
    });
  });

  test("does not mutate the original console through assignment, definition, or deletion", () => {
    withConsole((raw) => {
      const logger = createLog("TRACE", raw);
      logger.ReplaceGlobalConsole();
      const originalError = raw.error;
      const originalWarn = raw.warn;
      const override = vi.fn();
      console.error = override;
      expect(raw.error).toBe(originalError);
      console.error("local override");
      expect(override).toHaveBeenCalledExactlyOnceWith("local override");
      expect(originalError).not.toHaveBeenCalled();
      expect(Reflect.deleteProperty(console, "error")).toBe(true);
      expect(raw.error).toBe(originalError);
      Object.defineProperty(console, "warn", { configurable: true, value: override });
      expect(raw.warn).toBe(originalWarn);
      expect(Reflect.deleteProperty(console, "warn")).toBe(true);
      expect(raw.warn).toBe(originalWarn);
      logger.error("direct logging still works");
      expect(originalError).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("direct logging still works")
      );
    });
  });

  test("uses the original default writer when another logger initializes after console replacement", () => {
    withConsole((raw) => {
      const first = createLog("TRACE");
      first.ReplaceGlobalConsole();
      const currentConsole = console;
      const second = createLog("TRACE");
      expect(second.ReplaceGlobalConsole()).toBe(raw);
      expect(console).toBe(currentConsole);
      const secondOutput = second.error("second logger");
      first.error("first logger");
      console.error("global console");
      expect(raw.error).toHaveBeenCalledTimes(3);
      expect(raw.error).toHaveBeenNthCalledWith(1, secondOutput);
      expect(raw.error).toHaveBeenNthCalledWith(2, expect.stringContaining("first logger"));
      expect(raw.error).toHaveBeenNthCalledWith(3, expect.stringContaining("global console"));
      expect(Reflect.get(globalThis, "raw_console")).toBe(raw);
    });
  });

  test("restores the original console and allows a fresh replacement without local overrides", () => {
    withConsole((raw) => {
      const logger = createLog("TRACE", raw);
      logger.ReplaceGlobalConsole();
      const override = vi.fn();
      console.error = override;
      logger.RestoreGlobalConsole();
      expect(console).toBe(raw);
      expect(Reflect.get(globalThis, "raw_console")).toBeUndefined();
      console.error("restored console");
      expect(raw.error).toHaveBeenCalledExactlyOnceWith("restored console");
      expect(override).not.toHaveBeenCalled();
      logger.RestoreGlobalConsole();
      expect(console).toBe(raw);
      logger.ReplaceGlobalConsole();
      console.error("replaced again");
      expect(raw.error).toHaveBeenCalledTimes(2);
      expect(raw.error).toHaveBeenLastCalledWith(expect.stringContaining("replaced again"));
      expect(override).not.toHaveBeenCalled();
    });
  });

  test("snapshots writer methods and preserves their receiver", () => {
    withConsole((raw) => {
      const methods = ["trace", "debug", "log", "warn", "error"] as const;
      const original = Object.fromEntries(methods.map((method) => [method, raw[method]]));
      const logger = createLog("TRACE", raw);
      const replacement = vi.fn();
      for (const method of methods) raw[method] = replacement;
      logger.trace("trace message");
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");
      for (const method of methods) {
        expect(original[method]).toHaveBeenCalledTimes(1);
        expect(original[method]!.mock.contexts).toEqual([raw]);
      }
      expect(replacement).not.toHaveBeenCalled();
    });
  });

  test("retains log level filtering and methods outside the logger override", () => {
    withConsole((raw) => {
      const logger = createLog("WARN", raw);
      logger.ReplaceGlobalConsole();
      console.trace("hidden trace");
      console.debug("hidden debug");
      console.info("hidden info");
      expect(raw.trace).not.toHaveBeenCalled();
      expect(raw.debug).not.toHaveBeenCalled();
      expect(raw.log).not.toHaveBeenCalled();
      console.warn("visible warning");
      console.error("visible error");
      expect(raw.warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("visible warning"));
      expect(raw.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("visible error"));
      logger.currentLevel = LogLevel.NONE;
      console.error("hidden error");
      expect(raw.error).toHaveBeenCalledTimes(1);
      const data = [{ name: "unchanged console method" }];
      console.table(data);
      console.log("plain console log");
      expect(raw.table).toHaveBeenCalledExactlyOnceWith(data);
      expect(raw.log).toHaveBeenCalledExactlyOnceWith("plain console log");
    });
  });
});
