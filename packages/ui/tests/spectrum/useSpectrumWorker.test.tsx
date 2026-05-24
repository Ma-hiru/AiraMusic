import { act, type FC, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import {
  type SpectrumOptions,
  useSpectrumWorker
} from "@mahiru/ui/windows/main/hooks/useSpectrumWorker";

type SpectrumWorkerResult =
  | { type: "ready" }
  | { type: "spectrum"; bands: Float32Array }
  | { type: "spectrumWithPeaks"; data: Float32Array }
  | { type: "error"; error: string };

type MockWorkerInstance = {
  messages: Array<{ message: any; transfer?: Transferable[] }>;
  terminated: boolean;
  emit(data: SpectrumWorkerResult): void;
};

const workerState = vi.hoisted(() => ({
  instances: [] as MockWorkerInstance[]
}));

vi.mock("@mahiru/ui/common/constants/dev", () => ({
  Log: {
    error: vi.fn()
  }
}));

vi.mock("@mahiru/ui/worker/spectrum.ts?worker", () => {
  class MockSpectrumWorker {
    messages: Array<{ message: any; transfer?: Transferable[] }> = [];
    listeners: Array<(event: MessageEvent<SpectrumWorkerResult>) => void> = [];
    terminated = false;

    constructor() {
      workerState.instances.push(this);
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

  return { default: MockSpectrumWorker };
});

describe("useSpectrumWorker", () => {
  let host: HTMLDivElement;
  let root: Root;
  let rafCallbacks: FrameRequestCallback[];
  let now = 0;
  let originalRaf: typeof requestAnimationFrame;
  let originalCancelRaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    workerState.instances.length = 0;
    rafCallbacks = [];
    now = 0;
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    vi.restoreAllMocks();
  });

  it("limits frame posts in the hook and never sends fpsLimit to wasm", async () => {
    const audio = createAudioMock();

    renderHarness(audio, true, {
      fftSize: 16,
      fpsLimit: 30,
      numBands: 8,
      withPeaks: false
    });

    const worker = latestWorker();
    expect(worker.messages[0]?.message).toEqual({
      type: "init",
      sampleRate: 48_000,
      fftSize: 16,
      numBands: 8,
      withPeaks: false
    });

    await act(async () => {
      worker.emit({ type: "ready" });
    });

    await runNextFrame(0);
    expect(analyzeMessages(worker)).toHaveLength(1);
    expect(audio.context.analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(1);

    await act(async () => {
      worker.emit({ type: "spectrum", bands: new Float32Array([0.4, 0.8]) });
    });
    await runNextFrame(10);
    expect(analyzeMessages(worker)).toHaveLength(1);

    await runNextFrame(40);
    expect(analyzeMessages(worker)).toHaveLength(2);

    await runNextFrame(80);
    expect(analyzeMessages(worker)).toHaveLength(2);
  });

  it("keeps the shared spectrum data object stable when band options change", () => {
    const audio = createAudioMock();
    const snapshots: Array<ReturnType<typeof useSpectrumWorker>["spectrumData"]["current"]> = [];
    const onData = vi.fn((data) => snapshots.push(data));

    const Harness: FC<{ options: SpectrumOptions }> = ({ options }) => {
      const { spectrumData } = useSpectrumWorker(audio as any, true, options);
      useEffect(() => {
        onData(spectrumData.current);
      }, [options, spectrumData]);
      return null;
    };

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root.render(<Harness options={{ fftSize: 16, numBands: 8, withPeaks: false }} />);
    });

    const first = snapshots.at(-1);
    expect(first?.bands).toHaveLength(8);

    act(() => {
      root.render(<Harness options={{ fftSize: 16, numBands: 16, withPeaks: false }} />);
    });

    const second = snapshots.at(-1);
    expect(second).toBe(first);
    expect(second?.bands).toHaveLength(16);
  });

  function renderHarness(
    audio: ReturnType<typeof createAudioMock>,
    isPlaying: boolean,
    options: SpectrumOptions
  ) {
    const Harness: FC = () => {
      useSpectrumWorker(audio as any, isPlaying, options);
      return null;
    };

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<Harness />);
    });
  }

  async function runNextFrame(timestamp: number) {
    now = timestamp;
    const callback = rafCallbacks.shift();
    expect(callback).toBeDefined();
    await act(async () => {
      callback?.(timestamp);
    });
  }
});

function createAudioMock() {
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 1,
    getFloatTimeDomainData: vi.fn((target: Float32Array) => {
      target.fill(0.25);
    })
  };
  return {
    context: {
      analyser,
      ctx: {
        sampleRate: 48_000
      }
    }
  };
}

function latestWorker() {
  const worker = workerState.instances.at(-1);
  expect(worker).toBeDefined();
  return worker!;
}

function analyzeMessages(worker: MockWorkerInstance) {
  return worker.messages.filter(({ message }) => message.type === "analyze");
}
