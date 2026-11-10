import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { test, expect, describe } from "vitest";
import * as zlib from "node:zlib";

const appRequire = createRequire(resolve(import.meta.dirname, "../packages/app/package.json"));
const modulePath = appRequire.resolve("@neteasecloudmusicapienhanced/api/util/zstd.js");
const dependencyRequire = createRequire(modulePath);
const source = readFileSync(modulePath, "utf-8");

function loadCodec(native: boolean) {
  const module = { exports: {} as { decompress(input: Uint8Array): Buffer } };
  runInNewContext(source, {
    module,
    exports: module.exports,
    Buffer,
    require: (name: string) => (name === "zlib" ? (native ? zlib : {}) : dependencyRequire(name))
  });
  return module.exports;
}

// Single-segment frames with a known content size and raw or RLE blocks.
function frame(
  blocks: { data: Buffer; rle?: boolean; last?: boolean }[],
  contentSize = blocks.reduce((total, block) => total + block.data.length, 0)
) {
  const size = Buffer.alloc(contentSize < 256 ? 1 : 2);
  size.writeUIntLE(contentSize < 256 ? contentSize : contentSize - 256, 0, size.length);
  return Buffer.concat([
    Buffer.from([0x28, 0xb5, 0x2f, 0xfd, contentSize < 256 ? 0x20 : 0x60]),
    size,
    ...blocks.flatMap(({ data, rle = false, last = false }) => {
      const header = Buffer.alloc(3);
      header.writeUIntLE((data.length << 3) | (rle ? 2 : 0) | (last ? 1 : 0), 0, 3);
      return [header, rle ? data.subarray(0, 1) : data];
    })
  ]);
}

describe.each([
  { label: "Node Zstd", native: true },
  { label: "fzstd fallback", native: false }
])("NCM Zstd repair: $label", ({ native }) => {
  const { decompress } = loadCodec(native);

  test("keeps valid frames and concatenated frames intact", () => {
    const first = Buffer.from("0123456789");
    const second = Buffer.from("another frame");
    const encoded = frame([{ data: first, last: true }]);
    expect(decompress(encoded)).toEqual(first);
    expect(decompress(Buffer.concat([encoded, frame([{ data: second, last: true }])]))).toEqual(
      Buffer.concat([first, second])
    );
    const compressed = zlib.zstdCompressSync(Buffer.from("compressed content ".repeat(100)));
    expect(decompress(compressed)).toEqual(Buffer.from("compressed content ".repeat(100)));
  });

  test("recovers a missing empty last block after complete content", () => {
    const data = Buffer.from("0123456789");
    expect(decompress(frame([{ data }]))).toEqual(data);
  });

  test("recovers complete raw and RLE blocks with a two-byte content size", () => {
    const first = Buffer.from("a".repeat(150));
    const second = Buffer.from("b".repeat(150));
    expect(decompress(frame([{ data: first }, { data: second, rle: true }]))).toEqual(
      Buffer.concat([first, second])
    );
  });

  test("recovers a missing ending without a content size, as returned by NEAPI", () => {
    const data = Buffer.from("ECFG synthetic configuration");
    const encoded = frame([{ data }]);
    // The sampled NEAPI frame uses descriptor 0 / window 0x58, with no content size.
    const unknownSize = Buffer.concat([
      Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0, 0x58]),
      encoded.subarray(6)
    ]);
    expect(decompress(unknownSize)).toEqual(data);
  });

  test("still throws when adding an ending cannot decode the input", () => {
    expect(() => decompress(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))).toThrow();
    expect(() => decompress(Buffer.from("invalid zstd frame"))).toThrow();
  });
});
