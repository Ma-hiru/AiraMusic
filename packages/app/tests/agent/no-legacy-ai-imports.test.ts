import { resolve } from "node:path";
import { readdir, readFile } from "node:fs/promises";

const ProductionRoots = ["packages/app/src", "packages/ipc/src", "packages/ui/src"];

const DeprecatedAgentPatterns = [
  /@mahiru\/ai(?:\/|["'])/,
  /@mahiru\/app\/inner\/agent(?:\/|["'])/,
  /invoke_agent_(?:chat|abort|create_conversation|list_conversations|get_conversation|delete_conversation|list_threads|create_thread|get_thread|delete_thread|create_run|cancel_run|list_configs|create_config|update_config|list_providers|list_runs)/,
  /message_deliver_agent_chat_event/,
  /\b(?:LLMTool|LLMToolRegistry|LLMToolResult|AgentRequestError)\b/
];

it("does not reference deprecated TypeScript Agent contracts from production code", async () => {
  const repository = resolve(import.meta.dirname, "../../../..");
  const offenders: string[] = [];

  for (const root of ProductionRoots) {
    for (const file of await sourceFiles(resolve(repository, root))) {
      const source = await readFile(file, "utf8");
      const appTool = file.includes("/app/src/inner/agent/tools/");
      const ipc = file.includes("/ipc/src/");
      if (
        DeprecatedAgentPatterns.some((pattern) => pattern.test(source)) ||
        ((appTool || ipc) && source.includes("@mahiru/agent"))
      ) {
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
