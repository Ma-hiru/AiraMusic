import { FC, HTMLAttributes, memo, useEffect, useRef } from "react";
import { SpectrumOptions } from "@mahiru/ui/hook/useSpectrumWorker";
import { IRenderer, RendererOptions } from "./renderers/IRenderer";
import { Canvas2DRenderer } from "./renderers/canvas2d";
import { WebGLRendererRust } from "./renderers/webgl-rust";
import { useSpectrum } from "@mahiru/ui/ctx/SpectrumCtx";

type AudioSpectrumProps = HTMLAttributes<HTMLCanvasElement> & {
  isPlaying: boolean;
  color?: string;
  secondaryColor?: string;
  gap?: number;
  barWidth?: number;
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
  roundedCorners = "top",
  renderer = "canvas",
  heightScale = 1,
  ...rest
}) => {
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const rendererRef = useRef<Nullable<IRenderer>>(null);
  const { spectrumData, isReady, setSpectrumOptions } = useSpectrum();

  useEffect(() => {
    isPlaying && setSpectrumOptions(spectrumOptions);
  }, [isPlaying, setSpectrumOptions, spectrumOptions]);
  useEffect(() => {
    if (!isReady || !isPlaying) return;
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
    const render = renderer === "webgl-rust" ? new WebGLRendererRust() : new Canvas2DRenderer();
    const opts: RendererOptions = {
      width: cssW,
      height: cssH,
      dpr,
      color,
      gap,
      barWidth,
      secondaryColor,
      roundedCorners,
      heightScale
    };
    render.init(canvas, opts);
    // 每次参数变更都更新渲染器配置
    render.options = opts;
    rendererRef.current = render;
    let animationFrameId: number;
    const draw = () => {
      const { bands } = spectrumData.current;
      const count = bands.length;
      if (!count) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      rendererRef.current?.draw(bands);
      animationFrameId = requestAnimationFrame(draw);
    };
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
      try {
        rendererRef.current?.destroy();
      } catch {
        /** empty */
      }
      rendererRef.current = null;
    };
  }, [
    barWidth,
    color,
    gap,
    heightScale,
    isPlaying,
    isReady,
    renderer,
    roundedCorners,
    secondaryColor,
    spectrumData
  ]);
  return <canvas ref={canvasRef} {...rest} />;
};
export default memo(AudioSpectrum);
