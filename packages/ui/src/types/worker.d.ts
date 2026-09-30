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
