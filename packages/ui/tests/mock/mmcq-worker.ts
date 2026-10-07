export class MockMMCQWorker {
  messages: Array<{ message: any; transfer?: Transferable[] }> = [];
  listeners = new Map<string, Array<(event: any) => void>>();
  terminated = false;

  constructor() {
    mmcqWorkerMock.instances.push(this);
  }

  postMessage(message: any, transfer?: Transferable[]) {
    this.messages.push({ message, transfer });
  }

  addEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(data: any) {
    for (const listener of this.listeners.get("message") ?? []) listener({ data });
  }

  emitError(message: string) {
    for (const listener of this.listeners.get("error") ?? []) listener({ message });
  }

  terminate() {
    this.terminated = true;
  }
}

export const mmcqWorkerMock = { instances: [] as MockMMCQWorker[] };
