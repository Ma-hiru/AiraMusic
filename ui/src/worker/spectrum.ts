import init, { SpectrumAnalyzer, WindowFunction } from "@mahiru/wasm";

let analyser: Nullable<SpectrumAnalyzer> = null;
let fftSize = 0;
let numBands = 0;
let sampleRate = 48000;
let ready = false;

function postErr(msg: string) {
  self.postMessage({ type: "error", error: msg } satisfies SpectrumWorkerResult);
}

function ensureInput(payload: any): Float32Array {
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
          // 重新初始化时显式释放旧实例，避免依赖 GC 触发 wasm free
          try {
            analyser?.free();
          } catch {
            /** empty */
          }
          analyser = new SpectrumAnalyzer(fftSize, numBands, sampleRate);
          analyser.set_smoothing(0.8);
          analyser.set_peak_decay(0.02);
          analyser.set_window_function(WindowFunction.Blackman);
          analyser.set_fps_limit(data.fpsLimit);
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
        const bands = analyser.analyze_frame(input);
        // 直接传递 Float32Array，避免 Array.from 的大额分配
        self.postMessage(
          {
            type: "spectrum",
            bands
          } satisfies SpectrumWorkerResult,
          [bands.buffer]
        );
      } catch (err) {
        postErr("analyze error: " + String(err));
      }
      break;
    }
    case "analyzeWithPeaks": {
      if (!ready || !analyser) break;
      try {
        const input = ensureInput(data.data);
        const result = analyser.analyze_frame_with_peaks(input);
        self.postMessage(
          {
            type: "spectrumWithPeaks",
            data: result
          } satisfies SpectrumWorkerResult,
          [result.buffer]
        );
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
