import SpectrumWorker from "@mahiru/ui/worker/spectrum.ts?worker";
import { useCallback, useEffect, useRef, useState } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";

export interface SpectrumData {
  bands: Float32Array;
  peaks?: Float32Array;
  lowFreqVolume?: number;
}

export type SpectrumOptions = {
  fftSize?: number;
  numBands?: number;
  withPeaks?: boolean;
};

export function useSpectrumWorker(
  audioRef: { current: NormalFunc<[], Nullable<HTMLAudioElement>> },
  isPlaying: boolean,
  options: SpectrumOptions = {}
) {
  const { fftSize = 2048, numBands = 64, withPeaks = false } = options;
  const workerRef = useRef<Nullable<Worker>>(null);
  const analyserRef = useRef<Nullable<AnalyserNode>>(null);
  const audioCtxRef = useRef<Nullable<AudioContext>>(null);
  const animationFrameRef = useRef<number>(0);
  const samplesRef = useRef<Nullable<Float32Array<ArrayBuffer>>>(null);
  const spectrumData = useRef<SpectrumData>({
    bands: new Float32Array(numBands),
    peaks: withPeaks ? new Float32Array(numBands) : undefined,
    lowFreqVolume: 0
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
    const analyser = analyserRef.current;
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
  }, [isReady, isPlaying, withPeaks]);
  // 初始化 AudioContext 和 AnalyserNode，connect只在一个audioRef上执行一次
  useEffect(() => {
    const audio = audioRef.current();
    if (!audio) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;
    audioCtxRef.current = ctx;
    return () => {
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch();
      analyserRef.current = null;
      audioCtxRef.current = null;
    };
  }, [audioRef]);
  // 初始化 SpectrumWorker，随着 fftSize、numBands、withPeaks 变化而重新初始化
  useEffect(() => {
    const audio = audioRef.current;
    const analyser = analyserRef.current;
    const audioCtx = audioCtxRef.current;
    if (!audio || !analyser || !audioCtx) return;

    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = fftSize;

    const samples = new Float32Array(analyser.fftSize);
    const worker = new SpectrumWorker();

    worker.addEventListener("message", (e: MessageEvent<SpectrumWorkerResult>) => {
      const data = e.data;
      if (!data) return;
      switch (data.type) {
        case "ready": {
          setIsReady(true);
          break;
        }
        case "spectrum": {
          if (Array.isArray(data.bands)) {
            const arr = spectrumData.current.bands;
            const len = Math.min(arr.length, data.bands.length);
            for (let i = 0; i < len; i++) {
              arr[i] = data.bands[i]!;
            }
          }
          spectrumData.current.lowFreqVolume = data.lowFreqVolume;
          break;
        }
        case "spectrumWithPeaks": {
          if (Array.isArray(data.data)) {
            const d = data.data;
            const bandsArr = spectrumData.current.bands;
            const peaksArr = (spectrumData.current.peaks ||= new Float32Array(numBands));
            const pairLen = Math.min(numBands, Math.floor(d.length / 2));
            for (let i = 0; i < pairLen; i++) {
              const bandIndex = i * 2;
              const bandValue = d[bandIndex];
              const peakValue = d[bandIndex + 1];
              if (bandValue !== undefined) {
                bandsArr[i] = bandValue;
              }
              if (peakValue !== undefined) {
                peaksArr[i] = peakValue;
              }
            }
          }
          spectrumData.current.lowFreqVolume = data.lowFreqVolume;
          break;
        }
        case "error": {
          Log.error(
            new EqError({
              raw: data.error,
              message: "use spectrum worker error",
              label: "useSpectrum.ts"
            })
          );
          break;
        }
        default:
          break;
      }
    });

    worker.postMessage({
      type: "init",
      sampleRate: audioCtx.sampleRate,
      fftSize: analyser.fftSize,
      numBands,
      withPeaks
    } satisfies SpectrumWorkerArgs);

    workerRef.current = worker;
    samplesRef.current = samples;

    return () => {
      worker.terminate();
      setIsReady(false);
      workerRef.current = null;
      samplesRef.current = null;
    };
  }, [audioRef, fftSize, numBands, withPeaks]);
  // 当 numBands 或 withPeaks 变化时，更新 spectrumData 的结构
  useEffect(() => {
    spectrumData.current = {
      bands: new Float32Array(numBands),
      peaks: withPeaks ? new Float32Array(numBands) : undefined,
      lowFreqVolume: 0
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
