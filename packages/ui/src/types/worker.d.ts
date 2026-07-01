type SpectrumWorkerArgs =
  | { type: "reset" }
  | { type: "analyze"; data: Float32Array }
  | { factor: number; type: "setSmoothing" }
  | { data: Float32Array; type: "analyzeWithPeaks" }
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
