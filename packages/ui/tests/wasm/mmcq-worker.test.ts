import { join } from "node:path";
import { readFile } from "node:fs/promises";
import init, { extractPalette } from "@mahiru/wasm";

vi.mock("@mahiru/wasm", async (importOriginal) => {
  const wasm = await importOriginal<typeof import("@mahiru/wasm")>();
  return { ...wasm, default: vi.fn(wasm.default), extractPalette: vi.fn(wasm.extractPalette) };
});

let onMessage: (event: MessageEvent<any>) => Promise<void>;

beforeAll(async () => {
  vi.mocked(init).mockClear();
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
  const image = await readFile(join(process.cwd(), "../app/assets/logo.png"));
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
  await Promise.all(
    [2, 3].map((id) =>
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
    )
  );
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
