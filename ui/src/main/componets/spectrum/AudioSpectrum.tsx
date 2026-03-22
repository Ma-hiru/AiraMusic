import { FC, HTMLAttributes, memo, useEffect, useMemo, useRef } from "react";
import { SpectrumData, SpectrumOptions } from "@mahiru/ui/main/hooks/useSpectrumWorker";
import { IRenderer, RendererOptions } from "@mahiru/ui/main/componets/spectrum/renderers/IRenderer";
import { WebGLRendererRust } from "@mahiru/ui/main/componets/spectrum/renderers/webgl-rust";
import { Canvas2DRenderer } from "@mahiru/ui/main/componets/spectrum/renderers/canvas2d";
import { useListenResize } from "@mahiru/ui/public/hooks/useListenResize";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

type AudioSpectrumProps = HTMLAttributes<HTMLCanvasElement> & {
  isPlaying: boolean;
  color?: string;
  secondaryColor?: string;
  gap?: number;
  barWidth?: number;
  hideRightBands?: number;
  roundedCorners?: "top" | "bottom" | "both" | "none";
  renderer?: "canvas" | "webgl-rust";
  spectrumOptions?: SpectrumOptions;
  heightScale?: number;
};

const AudioSpectrum: FC<AudioSpectrumProps> = ({
  color = "#ffffff",
  gap = 2,
  isPlaying,
  spectrumOptions,
  secondaryColor = "#ffffff",
  barWidth,
  hideRightBands = 0,
  roundedCorners = "top",
  renderer = "canvas",
  heightScale = 1,
  ...rest
}) => {
  const { other, updateOther } = useLayoutStore();
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const rendererRef = useRef<Nullable<IRenderer>>(null);
  const playingRef = useRef(isPlaying);
  const hideRightBandsRef = useRef(hideRightBands);
  const spectrumDataRef = useRef<Optional<SpectrumData>>(null);
  const spectrumReadyRef = useRef<boolean>(false);
  playingRef.current = isPlaying;
  hideRightBandsRef.current = hideRightBands;
  spectrumDataRef.current = other.spectrumData();
  spectrumReadyRef.current = other.spectrumReady;

  const rendererFactory = useMemo(() => {
    return () => (renderer === "webgl-rust" ? new WebGLRendererRust() : new Canvas2DRenderer());
  }, [renderer]);
  // 监听 canvas 尺寸变化
  const sizeListener = useListenResize(canvasRef);
  const rendererOptions = useMemo(() => {
    void sizeListener;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 确保画布像素尺寸与显示尺寸一致（考虑设备像素比）
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    const targetW = Math.max(1, cssW * dpr);
    const targetH = Math.max(1, cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    return {
      options: {
        width: cssW,
        height: cssH,
        dpr,
        color,
        gap,
        barWidth,
        secondaryColor,
        roundedCorners,
        heightScale
      } as RendererOptions,
      canvas
    };
  }, [barWidth, color, gap, heightScale, roundedCorners, secondaryColor, sizeListener]);
  // 初始化和销毁渲染器
  useEffect(() => {
    if (!rendererOptions) return;
    const render = rendererFactory();
    const { canvas, options } = rendererOptions;
    render.init(canvas, options);
    rendererRef.current = render;
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [rendererFactory, rendererOptions]);
  // 渲染循环
  useEffect(() => {
    let animationFrameId: number;
    const draw = () => {
      const spectrumData = spectrumDataRef.current;
      if (!spectrumReadyRef.current || !playingRef.current || !spectrumData) {
        return requestIdleCallback(
          () => {
            animationFrameId = requestAnimationFrame(draw);
          },
          { timeout: 1000 }
        );
      }
      const { bands } = spectrumData;
      if (bands.length) {
        const hideCount = Math.max(0, Math.floor(hideRightBandsRef.current));
        const visibleCount = Math.max(0, bands.length - hideCount);
        if (visibleCount > 0) {
          rendererRef.current?.draw(
            visibleCount === bands.length ? bands : bands.subarray(0, visibleCount)
          );
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  // 更新频谱选项
  const spectrumOptionsKey = useMemo(
    () => JSON.stringify(spectrumOptions ?? null),
    [spectrumOptions]
  );
  useEffect(() => {
    if (!isPlaying) return;
    const currentStoreOptionsKey = JSON.stringify(other.spectrumOptions() ?? null);
    if (currentStoreOptionsKey === spectrumOptionsKey) return;
    updateOther(other.copy().setSpectrumOptions(spectrumOptions));
  }, [isPlaying, other, spectrumOptions, spectrumOptionsKey, updateOther]);
  return <canvas ref={canvasRef} {...rest} />;
};
export default memo(AudioSpectrum);
