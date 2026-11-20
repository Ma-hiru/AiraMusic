type SpectrumWorkerArgs =
  | { type: "reset" }
  | { factor: number; type: "setSmoothing" }
  | { type: "analyze"; elapsedMs: number; data: Float32Array }
  | { elapsedMs: number; data: Float32Array; type: "analyzeWithPeaks" }
  | {
      type: "init";
      fftSize: number;
      numBands: number;
      sampleRate: number;
      withPeaks: boolean;
    };

type SpectrumWorkerResult =
  | { type: "ready" }
  | { error: string; type: "error" }
  | { type: "spectrum"; bands: Float32Array }
  | { data: Float32Array; type: "spectrumWithPeaks" };

type MMCQWorkerArgs = {
  id: number;
  count: number;
  type: "extract";
  data: ArrayBuffer;
  dst_width: number;
  dst_height: number;
};

type MMCQWorkerResult =
  | { id: number; error: string; type: "error" }
  | { id: number; type: "palette"; colors: string[] };

type WaveProgressSize = { width: number; height: number; pixelRatio: number };

type WaveProgressOptions = {
  color: string;
  density: number;
  playing: boolean;
  visible: boolean;
  chorus?: number[];
  thumbColor: string;
  paddingLeft: number;
  paddingRight: number;
  trackOpacity: number;
};

type WaveProgressWorkerArgs =
  | { type: "detach" }
  | { type: "resize"; size: WaveProgressSize }
  | { type: "options"; options: WaveProgressOptions }
  | { buffer?: number; percent?: number; type: "progress"; immediate: boolean }
  | {
      id: number;
      type: "attach";
      size: WaveProgressSize;
      canvas: OffscreenCanvas;
      options: WaveProgressOptions;
      progress: { buffer: number; percent: number };
    };

type WaveProgressWorkerResult =
  | { error: string; type: "error" }
  | { id: number; type: "idle" | "ready" };
