import "@testing-library/jest-dom/vitest";
import init from "@mahiru/wasm";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const wasmPath = join(process.cwd(), "../wasm/pkg/wasm_bg.wasm");

beforeAll(async () => {
  const wasmBytes = await readFile(wasmPath);
  await init({
    module_or_path: wasmBytes
  });
});

Object.defineProperty(window, "electron", {
  value: {
    invoke: new Proxy(<typeof window.electron.invoke>{}, {
      get: () => {
        return () => {
          return Promise.resolve("");
        };
      }
    }),
    event: new Proxy(<typeof window.electron.event>{}, {
      get: () => {
        return () => {};
      }
    }),
    listener: new Proxy(<typeof window.electron.listener>{}, {
      get: () => {
        return () => {};
      }
    })
  },
  configurable: true,
  writable: true
});
