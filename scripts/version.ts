import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

import { AppEnv, TypedEnv } from "./env";

const env = TypedEnv.fromEnv(AppEnv.load(undefined, false));
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const current_version = env.var("APP_VERSION").replace("v", "");
const current_desc = env.var("APP_DESC");
const app_package = join(__dirname, "../packages/app/package.json");

async function sync_version() {
  try {
    const package_json = JSON.parse(await readFile(app_package, "utf-8"));
    const old_version = package_json["version"];
    const old_desc = package_json["description"];
    console.log(
      `[sync_version]\n - app/packages.json["version"]=v${old_version}\n - env["APP_VERSION"]=v${current_version}`
    );
    console.log(
      `[sync_version]\n - app/packages.json["description"]=${old_desc}\n - env["APP_DESC"]=${current_desc}`
    );
    if (old_version !== current_version) {
      console.log(`[sync_version] version not match: ${old_version} !== ${current_version}`);
      console.log(`[sync_version] update version: ${old_version} -> ${current_version}`);
      package_json["version"] = current_version;
      await writeFile(app_package, JSON.stringify(package_json, null, 2));
    } else {
      console.log(`[sync_version] version match: ${old_version} === ${current_version}`);
    }

    if (old_desc !== current_desc) {
      console.log(`[sync_version] description not match: ${old_desc} !== ${current_desc}`);
      console.log(`[sync_version] update description: ${old_desc} -> ${current_desc}`);
      package_json["description"] = current_desc;
      await writeFile(app_package, JSON.stringify(package_json, null, 2));
    } else {
      console.log(`[sync_version] description match: ${old_desc} === ${current_desc}`);
    }
  } catch (err) {
    console.error("[sync_version] error:", err);
  }
}

await sync_version();
