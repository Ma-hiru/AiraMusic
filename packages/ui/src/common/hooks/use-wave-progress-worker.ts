import { useRef, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import WaveProgressWorker from "@/worker/wave-progress.ts?worker";
import type { RefObject } from "react";
import type { PlayerProgressValues } from "@/common/hooks/use-progress-sync";

export function useWaveProgressWorker(
  hostRef: RefObject<null | HTMLDivElement>,
  options: WaveProgressOptions
) {
  const currentOptions = useLatestRef(options);
  const progress = useRef<PlayerProgressValues>({ percent: 0, buffer: 0 });
  const chorus = useRef<number[] | undefined>(undefined);
  const [staticFrame, setStaticFrame] = useState<{
    width: number;
    height: number;
    progress: PlayerProgressValues;
  }>();
  const session = useRef<
    | undefined
    | {
        refresh: () => void;
        sync: (values: Partial<PlayerProgressValues>, immediate: boolean) => void;
      }
  >(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let worker: Worker | undefined;
    let surface: undefined | { id: number; ready: boolean; canvas: HTMLCanvasElement };
    let nextId = 0;
    let failed = false;
    let size: WaveProgressSize = { width: 0, height: 0, pixelRatio: 1 };
    let pixelRatioQuery: undefined | MediaQueryList;
    const getOptions = () => ({ ...currentOptions.current, chorus: chorus.current });

    const showStatic = () => {
      const { width, height } = size;
      if (surface?.ready || !currentOptions.current.visible || !width || !height) {
        setStaticFrame(undefined);
        return;
      }
      const values = progress.current;
      setStaticFrame((previous) =>
        previous?.width === width &&
        previous.height === height &&
        previous.progress.percent === values.percent &&
        previous.progress.buffer === values.buffer
          ? previous
          : { width, height, progress: values }
      );
    };

    const removeSurface = () => {
      surface?.canvas.remove();
      surface = undefined;
    };

    const stopWorker = () => {
      worker?.terminate();
      worker = undefined;
      removeSurface();
    };

    const failWorker = (error: unknown) => {
      failed = true;
      stopWorker();
      Log.error({ label: "WaveProgress", message: "wave progress worker failed", raw: error });
      showStatic();
    };

    const post = (message: WaveProgressWorkerArgs) => {
      try {
        worker?.postMessage(message);
      } catch (error) {
        failWorker(error);
      }
    };

    const detach = () => {
      if (!surface) return;
      removeSurface();
      post({ type: "detach" });
    };

    const attach = () => {
      if (surface || failed || !size.width || !size.height) return;
      const canvas = document.createElement("canvas");
      if (typeof canvas.transferControlToOffscreen !== "function") {
        failed = true;
        return;
      }

      try {
        if (!worker) {
          const instance = new WaveProgressWorker();
          worker = instance;
          instance.addEventListener(
            "message",
            ({ data }: MessageEvent<WaveProgressWorkerResult>) => {
              if (worker !== instance) return;
              if (data.type === "error") {
                failWorker(data.error);
                return;
              }
              if (data.id !== surface?.id) return;
              if (data.type === "idle") {
                removeSurface();
                refresh();
                return;
              }
              surface.ready = true;
              surface.canvas.style.visibility = "";
              showStatic();
            }
          );
          instance.addEventListener("error", (event) => {
            if (worker === instance) failWorker(event.message);
          });
        }

        const id = ++nextId;
        surface = { id, canvas, ready: false };
        canvas.className = "absolute inset-0 block size-full pointer-events-none";
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.visibility = "hidden";
        host.append(canvas);
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage(
          {
            type: "attach",
            id,
            canvas: offscreen,
            size,
            options: getOptions(),
            progress: progress.current
          } satisfies WaveProgressWorkerArgs,
          [offscreen]
        );
      } catch (error) {
        failWorker(error);
      }
    };

    const refresh = () => {
      const { playing, visible } = currentOptions.current;
      if (!visible || !size.width || !size.height || (!playing && !surface?.ready)) {
        detach();
      } else if (surface) {
        post({ type: "options", options: getOptions() });
      } else if (playing) {
        attach();
      }
      showStatic();
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const pixelRatio = window.devicePixelRatio || 1;
      if (width === size.width && height === size.height && pixelRatio === size.pixelRatio) return;
      size = { width, height, pixelRatio };
      if (surface && width && height && currentOptions.current.visible) {
        post({ type: "resize", size });
        showStatic();
      } else {
        refresh();
      }
    };

    const watchPixelRatio = () => {
      pixelRatioQuery?.removeEventListener("change", watchPixelRatio);
      pixelRatioQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      pixelRatioQuery?.addEventListener("change", watchPixelRatio);
      resize();
    };

    session.current = {
      refresh,
      sync(values, immediate) {
        if (!currentOptions.current.visible) return;
        if (surface) post({ type: "progress", ...values, immediate });
        if (!surface?.ready) showStatic();
      }
    };

    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    observer?.observe(host);
    window.addEventListener("resize", resize);
    watchPixelRatio();
    return () => {
      session.current = undefined;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      pixelRatioQuery?.removeEventListener("change", watchPixelRatio);
      stopWorker();
    };
  }, [hostRef, currentOptions]);

  useEffect(() => session.current?.refresh(), [options]);

  const updateProgress = useCallback(
    (values: Partial<PlayerProgressValues>, immediate: boolean) => {
      progress.current = { ...progress.current, ...values };
      session.current?.sync(values, immediate);
    },
    []
  );

  const updateChorus = useCallback((positions?: number[]) => {
    if (chorus.current === positions) return;
    chorus.current = positions;
    session.current?.refresh();
  }, []);

  return { staticFrame, updateChorus, updateProgress };
}
