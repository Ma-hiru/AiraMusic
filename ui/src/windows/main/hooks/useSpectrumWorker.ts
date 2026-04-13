import AppAudio from "@mahiru/ui/public/player/audio";
import SpectrumWorker from "@mahiru/ui/worker/spectrum.ts?worker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";

export interface SpectrumData {
  bands: Float32Array;
  peaks?: Float32Array;
}

export type SpectrumOptions = {
  fftSize?: number;
  numBands?: number;
  withPeaks?: boolean;
  /** 频谱分析计算限帧（在 wasm/rust 端生效），0/undefined 表示不限制 */
  fpsLimit?: number;
};

export function useSpectrumWorker(
  audio: AppAudio,
  isPlaying: boolean,
  options: SpectrumOptions = {}
) {
  const { fftSize = 2048, numBands = 64, withPeaks = false, fpsLimit } = options;
  const workerRef = useRef<Nullable<Worker>>(null);
  const animationFrameRef = useRef<number>(0);
  const samplesRef = useRef<Nullable<Float32Array<ArrayBuffer>>>(null);
  const spectrumData = useRef<SpectrumData>({
    bands: new Float32Array(numBands),
    peaks: withPeaks ? new Float32Array(numBands) : undefined
  });
  const [isReady, setIsReady] = useState(false);

  const setSmoothing = useCallback((factor: number) => {
    workerRef.current?.postMessage({
      type: "setSmoothing",
      factor
    } satisfies SpectrumWorkerArgs);
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.postMessage({ type: "reset" } satisfies SpectrumWorkerArgs);
  }, []);

  const updateSpectrum = useCallback(() => {
    const analyser = audio.context.analyser;
    const worker = workerRef.current;
    const samples = samplesRef.current;
    if (!analyser || !worker || !samples || !isReady || !isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateSpectrum);
      return;
    }
    analyser.getFloatTimeDomainData(samples);
    const payload = samples.slice();
    worker.postMessage(
      {
        type: withPeaks ? "analyzeWithPeaks" : "analyze",
        data: payload
      } satisfies SpectrumWorkerArgs,
      [payload.buffer]
    );
    animationFrameRef.current = requestAnimationFrame(updateSpectrum);
  }, [audio, isReady, isPlaying, withPeaks]);

  // 初始化 SpectrumWorker，随着 fftSize、numBands、withPeaks 变化而重新初始化
  useEffect(() => {
    const analyser = audio.context.analyser;
    const audioCtx = audio.context.ctx;
    if (!analyser || !audioCtx) return;

    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = fftSize;
    samplesRef.current = new Float32Array(analyser.fftSize);

    if (!workerRef.current) {
      workerRef.current = new SpectrumWorker();
      workerRef.current.addEventListener("message", (e: MessageEvent<SpectrumWorkerResult>) => {
        const data = e.data;
        if (!data) return;
        switch (data.type) {
          case "ready": {
            setIsReady(true);
            break;
          }
          case "spectrum": {
            if (data.bands instanceof Float32Array) {
              const arr = spectrumData.current.bands;
              arr.set(data.bands.subarray(0, arr.length));
            }
            break;
          }
          case "spectrumWithPeaks": {
            if (data.data instanceof Float32Array) {
              const d = data.data;
              const bandsArr = spectrumData.current.bands;
              const peaksArr = (spectrumData.current.peaks ||= new Float32Array(numBands));
              const pairLen = Math.min(numBands, Math.floor(d.length / 2));
              for (let i = 0; i < pairLen; i++) {
                const bandIndex = i * 2;
                bandsArr[i] = d[bandIndex] ?? 0;
                peaksArr[i] = d[bandIndex + 1] ?? 0;
              }
            }
            break;
          }
          case "error": {
            Log.error({
              raw: data.error,
              message: "spectrum worker error",
              label: "useSpectrum"
            });
            break;
          }
          default:
            break;
        }
      });
    }

    workerRef.current.postMessage({
      type: "init",
      sampleRate: audioCtx.sampleRate,
      fftSize: analyser.fftSize,
      numBands,
      withPeaks,
      fpsLimit
    } satisfies SpectrumWorkerArgs);

    return () => {
      setIsReady(false);
      workerRef.current?.terminate();
      workerRef.current = null;
      samplesRef.current = null;
    };
  }, [fftSize, fpsLimit, numBands, withPeaks, audio]);
  // 当 numBands 或 withPeaks 变化时，更新 spectrumData 的结构
  useEffect(() => {
    spectrumData.current = {
      bands: new Float32Array(numBands),
      peaks: withPeaks ? new Float32Array(numBands) : undefined
    };
  }, [numBands, withPeaks]);
  // 根据 isPlaying 和 isReady 状态，启动或停止频谱数据的更新循环
  useEffect(() => {
    if (!isReady || !isPlaying) return;
    animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isReady, updateSpectrum]);

  return {
    spectrumData,
    isReady,
    reset,
    setSmoothing
  };
}
