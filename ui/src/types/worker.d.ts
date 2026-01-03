type KMeansWorkerArgs = {
  id: number;
  url: string;
};

type KMeansWorkerResult = {
  ok: boolean;
  id: number;
  result: string[];
  error?: string;
};

type SpectrumWorkerArgs =
  | {
      type: "init";
      fftSize: number;
      numBands: number;
      withPeaks: boolean;
      sampleRate: number;
    }
  | { type: "analyze"; data: Float32Array }
  | { type: "analyzeWithPeaks"; data: Float32Array }
  | { type: "setSmoothing"; factor: number }
  | { type: "reset" };

type SpectrumWorkerResult =
  | { type: "ready" }
  | { type: "spectrum"; bands: Float32Array; lowFreqVolume: number }
  | { type: "spectrumWithPeaks"; data: Float32Array; lowFreqVolume: number }
  | { type: "error"; error: string };
