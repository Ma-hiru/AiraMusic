import { extractPalette } from "@mahiru/wasm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const imagePath = join(process.cwd(), "./packages/app/assets/logo.png");

describe("test mmcq", () => {
  it("should not be empty, and length should be 5", async () => {
    const data = await readFile(imagePath);
    const result = extractPalette(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      128,
      128,
      5
    );
    expect(result).not.deep.equal([]);
    expect(typeof result[0]).equal("string");
    expect(result.length).equal(5);
    console.log("mmcq result:", result);
  });

  it("should be empty", () => {
    const result = extractPalette(new Uint8Array(new ArrayBuffer(0)), 64, 64, 5);
    expect(result).deep.equal([]);
  });
});
