import sharp from "sharp";
import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function generateLogo() {
  const svg = fs.readFileSync(join(__dirname, "../app/assets/logo.svg"));
  await sharp(svg).resize(512, 512).png().toFile(join(__dirname, "../app/assets/logo.png"));
  console.log("done");
}
