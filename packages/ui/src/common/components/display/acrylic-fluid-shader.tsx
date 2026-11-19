import { memo, useRef, type FC, useEffect } from "react";
import { Log } from "@/common/lib/log";
import { FluidRenderer } from "@/common/lib/fluid-renderer";
import { useLatestRef } from "@/common/hooks/use-latest-ref";

interface AcrylicFluidShaderProps {
  blur: number;
  speed: number;
  opacity: number;
  paused: boolean;
  duration: number;
  saturate: number;
  brightness: number;
  className?: string;
  image: HTMLImageElement;
  /** WebGL 不可用或上下文丢失时回调，调用方应回退到 CSS 实现 */
  onUnsupported?: NormalFunc;
}

/**
 * 着色器版流体背景：低分辨率合成与旋涡、降采样、两趟后模糊，最后呈现。
 * 调色和压暗在后模糊之后完成；外层只保留轻微提亮，不再叠加静态渐变。
 */
const AcrylicFluidShader: FC<AcrylicFluidShaderProps> = ({
  className,
  onUnsupported,
  blur,
  image,
  speed,
  paused,
  opacity,
  duration,
  saturate,
  brightness
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<null | FluidRenderer>(null);
  const unsupportedRef = useLatestRef(onUnsupported);
  // 模糊、调色和淡入时长仅在初始化时读取；图片、暂停、速度和不透明度可运行时更新。
  const initialRef = useRef({ blur, saturate, brightness, speed, duration, opacity });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: null | FluidRenderer = null;
    try {
      renderer = new FluidRenderer(canvas, {
        ...initialRef.current,
        fadeDuration: initialRef.current.duration,
        onContextLost: () => unsupportedRef.current?.()
      });
    } catch (error) {
      // 交给调用方回退，不留半初始化的画布
      Log.warn(`流体背景：着色器不可用，回退到 CSS 实现。${String(error)}`);
      unsupportedRef.current?.();
      return;
    }

    rendererRef.current = renderer;
    return () => {
      renderer?.destroy();
      rendererRef.current = null;
    };
  }, [unsupportedRef]);

  useEffect(() => {
    rendererRef.current?.setImage(image);
  }, [image]);

  useEffect(() => {
    rendererRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    rendererRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    rendererRef.current?.setOpacity(opacity);
  }, [opacity]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
};

export default memo(AcrylicFluidShader);
