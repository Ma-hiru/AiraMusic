const task = new Map<string, PromiseFunc>();

export function addCloseTask(key: string, func: PromiseFunc) {
  task.set(key, func);
}

export function runCloseTask() {
  const tasks: Promise<void>[] = [];
  for (const func of task.values()) {
    tasks.push(func().catch());
  }
  return Promise.all(tasks);
}
