type SpectrumWorkerArgs =
  | {
      type: "init";
      fftSize: number;
      numBands: number;
      withPeaks: boolean;
      sampleRate: number;
      fpsLimit?: number;
    }
  | { type: "analyze"; data: Float32Array }
  | { type: "analyzeWithPeaks"; data: Float32Array }
  | { type: "setSmoothing"; factor: number }
  | { type: "reset" };

type SpectrumWorkerResult =
  | { type: "ready" }
  | { type: "spectrum"; bands: Float32Array }
  | { type: "spectrumWithPeaks"; data: Float32Array }
  | { type: "error"; error: string };
