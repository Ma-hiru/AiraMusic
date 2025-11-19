import os from "node:os";
import { join } from "node:path";
import { access, writeFile } from "node:fs/promises";

const tokenPath = join(os.tmpdir(), "anonymous_token");

export async function ensureAnonToken() {
  try {
    await access(tokenPath);
  } catch {
    await writeFile(tokenPath, "");
  }
  if (!process.env.NCM_API_ANON_TOKEN) {
    process.env.NCM_API_ANON_TOKEN = tokenPath;
  }
  return tokenPath;
}
