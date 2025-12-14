import init, { SpectrumAnalyzer, WindowFunction } from "@mahiru/wasm";

let analyser: Nullable<SpectrumAnalyzer> = null;
let fftSize = 0;
let numBands = 0;
let sampleRate = 48000;
let ready = false;

function postErr(msg: string) {
  self.postMessage({ type: "error", error: msg } satisfies SpectrumWorkerResult);
}

function ensureInput(payload: Float32Array): Float32Array {
  if (payload instanceof Float32Array) {
    return payload;
  }
  return new Float32Array(payload);
}

self.addEventListener("message", (ev: MessageEvent<SpectrumWorkerArgs>) => {
  const data = ev.data;
  if (!data) return;
  switch (data.type) {
    case "init": {
      fftSize = data.fftSize;
      numBands = data.numBands;
      sampleRate = data.sampleRate || 48000;
      ready = false;
      (async () => {
        try {
          await init();
          analyser = new SpectrumAnalyzer(fftSize, numBands, sampleRate);
          analyser.set_smoothing(0.8);
          analyser.set_peak_decay(0.02);
          analyser.set_window_function(WindowFunction.Hamming);
          ready = true;
          self.postMessage({ type: "ready" } satisfies SpectrumWorkerResult);
        } catch (err) {
          postErr("failed to initialize wasm module: " + String(err));
        }
      })();
      break;
    }
    case "analyze": {
      if (!ready || !analyser) break;
      try {
        const input = ensureInput(data.data);
        const raw = analyser.analyze_frame(input);
        const lowFreqVolume = raw[raw.length - 1] ?? 0;
        const bands = raw.subarray(0, raw.length - 1);
        self.postMessage({
          type: "spectrum",
          bands: Array.from(bands),
          lowFreqVolume
        } satisfies SpectrumWorkerResult);
      } catch (err) {
        postErr("analyze error: " + String(err));
      }
      break;
    }
    case "analyzeWithPeaks": {
      if (!ready || !analyser) break;
      try {
        const input = ensureInput(data.data);
        const rawResult = analyser.analyze_frame_with_peaks(input);
        const lowFreqVolume = rawResult[rawResult.length - 1] ?? 0;
        const result = rawResult.subarray(0, rawResult.length - 1);
        self.postMessage({
          type: "spectrumWithPeaks",
          data: Array.from(result),
          lowFreqVolume
        } satisfies SpectrumWorkerResult);
      } catch (err) {
        postErr("analyzeWithPeaks error: " + String(err));
      }
      break;
    }
    case "setSmoothing": {
      analyser?.set_smoothing(data.factor);
      break;
    }
    case "reset": {
      analyser?.reset();
      break;
    }
    default:
      break;
  }
});
