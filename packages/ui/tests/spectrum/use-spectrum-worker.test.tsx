import { act, cleanup, renderHook } from "@testing-library/react";
import {
  useSpectrumWorker,
  type SpectrumOptions
} from "@mahiru/ui/wins/main/hooks/use-spectrum-worker";

import { spectrumWorkerMock, type MockSpectrumWorkerInstance } from "../mock/spectrum-worker";

type RenderHookProps = {
  isPlaying: boolean;
  options: SpectrumOptions;
};

vi.mock("@mahiru/ui/worker/spectrum.ts?worker", async () => {
  const { MockSpectrumWorker } = await import("../mock/spectrum-worker");
  return { default: MockSpectrumWorker };
});

describe("useSpectrumWorker", () => {
  let rafCallbacks: FrameRequestCallback[];
  let now = 0;
  let originalRaf: typeof requestAnimationFrame;
  let originalCancelRaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    spectrumWorkerMock.instances.length = 0;
    rafCallbacks = [];
    now = 0;
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    cleanup();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    vi.restoreAllMocks();
  });

  it("initializes the worker from audio settings without passing UI-only options", () => {
    const audio = createAudioMock();

    const { result } = renderSpectrumHook(audio, {
      isPlaying: true,
      options: {
        fftSize: 16,
        fpsLimit: 30,
        numBands: 8,
        withPeaks: false
      }
    });

    expect(audio.context.analyser.fftSize).toBe(16);
    expect(audio.context.analyser.smoothingTimeConstant).toBe(0);
    expect(result.current.isReady).toBe(false);
    expect(latestWorker().messages[0]?.message).toEqual({
      type: "init",
      sampleRate: 48_000,
      fftSize: 16,
      numBands: 8,
      withPeaks: false
    });
  });

  it("posts frames only when ready and playing, respecting fps and pending work", async () => {
    const audio = createAudioMock();

    renderSpectrumHook(audio, {
      isPlaying: true,
      options: {
        fftSize: 16,
        fpsLimit: 30,
        numBands: 8,
        withPeaks: false
      }
    });

    const worker = latestWorker();

    expect(rafCallbacks).toHaveLength(0);
    expect(analyzeMessages(worker)).toHaveLength(0);

    act(() => {
      worker.emit({ type: "ready" });
    });

    await runNextFrame(0);
    expect(analyzeMessages(worker)).toHaveLength(1);
    expect(audio.context.analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(1);

    await runNextFrame(10);
    expect(analyzeMessages(worker)).toHaveLength(1);

    act(() => {
      worker.emit({ type: "spectrum", bands: new Float32Array([0.4, 0.8]) });
    });

    await runNextFrame(40);
    expect(analyzeMessages(worker)).toHaveLength(2);

    await runNextFrame(80);
    expect(analyzeMessages(worker)).toHaveLength(2);
  });

  it("writes spectrum and peak responses into the stable result object", () => {
    const audio = createAudioMock();

    const { result } = renderSpectrumHook(audio, {
      isPlaying: true,
      options: {
        fftSize: 16,
        numBands: 3,
        withPeaks: true
      }
    });
    const firstData = result.current.spectrumData.current;

    act(() => {
      latestWorker().emit({
        type: "spectrumWithPeaks",
        data: new Float32Array([0.1, 0.9, 0.2, 0.8, 0.3, 0.7])
      });
    });

    expect(result.current.spectrumData.current).toBe(firstData);
    expect(toRoundedArray(result.current.spectrumData.current?.bands)).toEqual([0.1, 0.2, 0.3]);
    expect(toRoundedArray(result.current.spectrumData.current?.peaks)).toEqual([0.9, 0.8, 0.7]);
  });

  it("keeps the shared spectrum data object stable when band options change", () => {
    const audio = createAudioMock();

    const { result, rerender } = renderSpectrumHook(audio, {
      isPlaying: true,
      options: { fftSize: 16, numBands: 8, withPeaks: false }
    });
    const firstData = result.current.spectrumData.current;

    expect(firstData?.bands).toHaveLength(8);

    rerender({
      isPlaying: true,
      options: { fftSize: 16, numBands: 16, withPeaks: false }
    });

    expect(result.current.spectrumData.current).toBe(firstData);
    expect(result.current.spectrumData.current?.bands).toHaveLength(16);
    expect(result.current.spectrumData.current?.peaks).toBeUndefined();
  });

  it("exposes worker control helpers and terminates the worker on unmount", () => {
    const audio = createAudioMock();

    const { result, unmount } = renderSpectrumHook(audio, {
      isPlaying: false,
      options: { fftSize: 16, numBands: 8, withPeaks: false }
    });
    const worker = latestWorker();

    act(() => {
      result.current.setSmoothing(0.6);
      result.current.reset();
    });

    expect(worker.messages.map(({ message }) => message)).toContainEqual({
      type: "setSmoothing",
      factor: 0.6
    });
    expect(worker.messages.map(({ message }) => message)).toContainEqual({ type: "reset" });

    unmount();

    expect(worker.terminated).toBe(true);
  });

  function renderSpectrumHook(audio: ReturnType<typeof createAudioMock>, props: RenderHookProps) {
    return renderHook(
      ({ options, isPlaying }: RenderHookProps) => {
        return useSpectrumWorker(audio as any, isPlaying, options);
      },
      { initialProps: props }
    );
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
  const worker = spectrumWorkerMock.instances.at(-1);
  expect(worker).toBeDefined();
  return worker!;
}

function analyzeMessages(worker: MockSpectrumWorkerInstance) {
  return worker.messages.filter(({ message }) => message.type === "analyze");
}

function toRoundedArray(data?: Float32Array) {
  return Array.from(data ?? [], (value) => Number(value.toFixed(1)));
}
