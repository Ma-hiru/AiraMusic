import { Renderer } from "@mahiru/ui/utils/renderer";

const task = new Map<string, PromiseFunc>();

export function setCloseTask(key: string, func: PromiseFunc<[], any>) {
  task.set(key, func);
}

export function runCloseTask() {
  const tasks: Promise<void>[] = [];
  for (const func of task.values()) {
    tasks.push(func().catch());
  }
  Promise.allSettled(tasks).finally(() => {
    Renderer.event.close({ broadcast: true });
  });
}

Renderer.addMainProcessMessageHandler("mainProcessExit", runCloseTask);
