import { resolve } from "node:path";
import { readdir, readFile } from "node:fs/promises";

const ProductionRoots = ["packages/app/src", "packages/ipc/src", "packages/ui/src"];

const DeprecatedAgentPatterns = [
  /@mahiru\/ai(?:\/|["'])/,
  /@mahiru\/app\/inner\/agent(?:\/|["'])/,
  /invoke_agent_(?:chat|abort|create_conversation|list_conversations|get_conversation|delete_conversation)/
];

it("does not reference deprecated TypeScript Agent contracts from production code", async () => {
  const repository = resolve(import.meta.dirname, "../../../..");
  const offenders: string[] = [];

  for (const root of ProductionRoots) {
    for (const file of await sourceFiles(resolve(repository, root))) {
      const source = await readFile(file, "utf8");
      if (DeprecatedAgentPatterns.some((pattern) => pattern.test(source))) {
        offenders.push(file.slice(repository.length + 1).replaceAll("\\", "/"));
      }
    }
  }

  expect(offenders).toEqual([]);
});

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}
