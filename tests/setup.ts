import "@testing-library/jest-dom/vitest";
import init from "@mahiru/wasm";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const wasmPath = join(process.cwd(), "./packages/wasm/pkg/wasm_bg.wasm");

beforeAll(async () => {
  const wasmBytes = await readFile(wasmPath);
  await init({
    module_or_path: wasmBytes
  });
});
