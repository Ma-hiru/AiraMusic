import "@testing-library/jest-dom/vitest";

import { join } from "node:path";
import { vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import init from "@mahiru/wasm";

import { resetLogMock } from "./mock/log";

vi.mock("@/common/lib/log", async () => await import("./mock/log"));
vi.mock("@mahiru/ui/common/lib/log", async () => await import("./mock/log"));
vi.mock("@mahiru/ipc/renderer", async () => await import("./mock/ipc"));

afterEach(() => {
  resetLogMock();
});

const wasmPath = join(process.cwd(), "../wasm/pkg/wasm_bg.wasm");

beforeAll(async () => {
  const wasmBytes = await readFile(wasmPath);
  await init({
    module_or_path: wasmBytes
  });
});
