export type SpectrumWorkerResult =
  | { type: "ready" }
  | { type: "spectrum"; bands: Float32Array }
  | { type: "spectrumWithPeaks"; data: Float32Array }
  | { type: "error"; error: string };

export type MockSpectrumWorkerInstance = {
  messages: Array<{ message: any; transfer?: Transferable[] }>;
  terminated: boolean;
  emit(data: SpectrumWorkerResult): void;
};

export const spectrumWorkerMock = {
  instances: [] as MockSpectrumWorkerInstance[]
};

export class MockSpectrumWorker {
  messages: Array<{ message: any; transfer?: Transferable[] }> = [];
  listeners: Array<(event: MessageEvent<SpectrumWorkerResult>) => void> = [];
  terminated = false;

  constructor() {
    spectrumWorkerMock.instances.push(this);
  }

  postMessage(message: any, transfer?: Transferable[]) {
    this.messages.push({ message, transfer });
  }

  addEventListener(type: string, listener: (event: MessageEvent<SpectrumWorkerResult>) => void) {
    if (type === "message") {
      this.listeners.push(listener);
    }
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: SpectrumWorkerResult) {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent<SpectrumWorkerResult>);
    }
  }
}
