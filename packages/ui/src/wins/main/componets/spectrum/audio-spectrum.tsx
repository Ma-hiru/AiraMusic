import { useAtom, useAtomValue } from "jotai";
import { memo, useRef, type FC, useMemo, useEffect, type HTMLAttributes } from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenResize } from "@/common/hooks/use-listen-resize";
import { Canvas2DRenderer } from "@/wins/main/componets/spectrum/renderers/canvas2d";
import { WebGLRendererRust } from "@/wins/main/componets/spectrum/renderers/webgl-rust";
import {
  spectrumDataAtom,
  spectrumReadyAtom,
  spectrumOptionsAtom
} from "@/wins/main/atoms/spectrum";
import {
  type IRenderer,
  type RendererOptions
} from "@/wins/main/componets/spectrum/renderers/i-renderer";
import type { SpectrumOptions } from "@/wins/main/hooks/use-spectrum-worker";

type AudioSpectrumProps = HTMLAttributes<HTMLCanvasElement> & {
  gap?: number;
  color?: string;
  barWidth?: number;
  isPlaying: boolean;
  heightScale?: number;
  hideRightBands?: number;
  secondaryColor?: string;
  spectrumOptions?: SpectrumOptions;
  renderer?: "canvas" | "webgl-rust";
  roundedCorners?: "top" | "both" | "none" | "bottom";
};

const AudioSpectrum: FC<AudioSpectrumProps> = ({
  gap = 2,
  barWidth,
  isPlaying,
  heightScale = 1,
  color = "#ffffff",
  hideRightBands = 0,
  renderer = "canvas",
  roundedCorners = "top",
  secondaryColor = "#ffffff",
  spectrumOptions: options = null,
  ...rest
}) => {
  const [spectrumOptions, setSpectrumOptions] = useAtom(spectrumOptionsAtom);
  const spectrumReady = useAtomValue(spectrumReadyAtom);
  const spectrumData = useAtomValue(spectrumDataAtom);
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const rendererRef = useRef<Nullable<IRenderer>>(null);
  const playingRef = useLatestRef(isPlaying);
  const hideRightBandsRef = useLatestRef(hideRightBands);
  const spectrumDataRef = useLatestRef(spectrumData);
  const spectrumReadyRef = useLatestRef(spectrumReady);

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
        animationFrameId = requestAnimationFrame(draw);
        return;
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
  }, [hideRightBandsRef, playingRef, spectrumDataRef, spectrumReadyRef]);

  // 更新频谱选项(在激活时)
  const spectrumOptionsKey = useMemo(() => JSON.stringify(options), [options]);
  useEffect(() => {
    if (!isPlaying) return;
    if (JSON.stringify(spectrumOptions) === spectrumOptionsKey) return;
    setSpectrumOptions(options);
  }, [isPlaying, options, setSpectrumOptions, spectrumOptions, spectrumOptionsKey]);

  return <canvas ref={canvasRef} {...rest} />;
};

export default memo(AudioSpectrum);
