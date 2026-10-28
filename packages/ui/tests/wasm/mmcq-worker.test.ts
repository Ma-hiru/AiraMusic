import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import init, { extractPalette } from "@mahiru/wasm";

vi.mock("@mahiru/wasm", async (importOriginal) => {
  const wasm = await importOriginal<typeof import("@mahiru/wasm")>();
  return { ...wasm, default: vi.fn(wasm.default), extractPalette: vi.fn(wasm.extractPalette) };
});

let onMessage: (event: MessageEvent<any>) => Promise<void>;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(init).mockReset();
  vi.mocked(extractPalette).mockReset();
  const listener = vi.spyOn(self, "addEventListener").mockImplementation((type, callback) => {
    if (type === "message") onMessage = callback as typeof onMessage;
  });
  try {
    await import("@mahiru/ui/worker/mmcq");
  } finally {
    listener.mockRestore();
  }
});

afterEach(() => vi.restoreAllMocks());

it("returns the same palette as direct WASM extraction with the request id", async () => {
  const image = await readFile(resolve(import.meta.dirname, "../../../app/assets/logo.png"));
  const data = Uint8Array.from(image).buffer;
  const expected = extractPalette(new Uint8Array(data), 64, 64, 5);
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});

  await onMessage({
    data: { id: 1, type: "extract", data, dst_width: 64, dst_height: 64, count: 5 }
  } as MessageEvent);

  expect(expected).toHaveLength(5);
  expect(post).toHaveBeenLastCalledWith({ id: 1, type: "palette", colors: expected });
});

it("reuses WASM initialization across concurrent requests", async () => {
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});
  const initializeWasm = vi.mocked(init).getMockImplementation()!;
  let finishInitialization!: () => void;
  const initialization = new Promise<void>((resolve) => {
    finishInitialization = resolve;
  });
  vi.mocked(init).mockImplementationOnce(async () => {
    await initialization;
    return initializeWasm();
  });
  const requests = [2, 3].map((id) =>
    onMessage({
      data: {
        id,
        type: "extract",
        data: new ArrayBuffer(0),
        dst_width: 64,
        dst_height: 64,
        count: 5
      }
    } as MessageEvent)
  );
  try {
    expect(init).toHaveBeenCalledTimes(1);
    expect(extractPalette).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  } finally {
    finishInitialization();
    await Promise.all(requests);
  }
  expect(extractPalette).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenCalledWith({ id: 2, type: "palette", colors: [] });
  expect(post).toHaveBeenCalledWith({ id: 3, type: "palette", colors: [] });
  expect(init).toHaveBeenCalledTimes(1);
});

it("returns extraction errors with the matching request id", async () => {
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});
  vi.mocked(extractPalette).mockImplementationOnce(() => {
    throw new Error("extraction failed");
  });
  await onMessage({
    data: {
      id: 4,
      type: "extract",
      data: new ArrayBuffer(0),
      dst_width: 64,
      dst_height: 64,
      count: 5
    }
  } as MessageEvent);
  expect(post).toHaveBeenLastCalledWith({
    id: 4,
    type: "error",
    error: "failed to extract palette using MMCQ: Error: extraction failed"
  });
});
