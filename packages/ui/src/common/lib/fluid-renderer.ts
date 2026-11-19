import { FluidRenderer as WasmFluidRenderer } from "@mahiru/wasm";

export interface FluidRendererOptions {
  /** 封面预滤波参数；场景合成后的模糊由低分辨率 GPU 管线处理 */
  blur: number;
  speed: number;
  saturate: number;
  brightness: number;
  /** 帧率上限，默认 60 */
  fps?: number;
  /** 最终 CSS 不透明度，用于补偿输出抖动幅度 */
  opacity?: number;
  textureSize?: number;
  fadeDuration?: number;
  maxPixelRatio?: number;
  /** 初始化、上传、绘制失败或上下文丢失时回退到 CSS */
  onContextLost?: NormalFunc;
}

/** Rust/WASM 负责烘焙、WebGL 与动画状态，这里只适配浏览器生命周期。 */
export class FluidRenderer {
  private renderer: WasmFluidRenderer;
  private raf = 0;
  private disposed = false;
  private lastSizeCheck = -Infinity;
  private width = 1;
  private height = 1;
  private paused = false;
  private resizeObserver?: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private options: FluidRendererOptions
  ) {
    this.renderer = new WasmFluidRenderer(canvas, {
      blur: options.blur,
      saturate: options.saturate,
      brightness: options.brightness,
      speed: options.speed,
      opacity: options.opacity ?? 1,
      fps: options.fps ?? 60,
      fadeDuration: options.fadeDuration ?? 800,
      textureSize: options.textureSize ?? 512
    });
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    window.addEventListener("resize", this.handleResize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(canvas);
    }
    this.requestFrame();
  }

  setImage(image: HTMLImageElement) {
    if (this.disposed) return;
    try {
      this.renderer.setImage(image, performance.now());
      this.requestFrame();
    } catch {
      this.fail();
    }
  }

  setPaused(paused: boolean) {
    if (this.disposed) return;
    this.paused = paused;
    this.renderer.setPaused(paused);
    this.requestFrame();
  }

  setSpeed(speed: number) {
    if (this.disposed) return;
    this.renderer.setSpeed(speed);
    if (!this.paused) this.requestFrame();
  }

  setOpacity(opacity: number) {
    if (this.disposed) return;
    this.renderer.setOpacity(opacity);
    this.requestFrame();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    // destroy 释放 GPU 对象，free 释放 wasm 结构体；StrictMode 可复用 canvas。
    this.renderer.destroy();
    this.renderer.free();
  }

  private fail() {
    this.destroy();
    this.options.onContextLost?.();
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.fail();
  };

  private requestFrame() {
    if (!this.disposed && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private handleResize = () => {
    if (this.disposed) return;
    this.lastSizeCheck = -Infinity;
    this.requestFrame();
  };

  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    try {
      // 限制布局读取频率；缩放只更新画布尺寸，不重新烘焙封面。
      if (now - this.lastSizeCheck >= 150) {
        this.lastSizeCheck = now;
        const ratio = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio ?? 1.25);
        this.width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
        this.height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
      }
      // 静止后连 rAF 空轮询也停止；换图、缩放或恢复动画再唤醒。
      if (this.renderer.render(now, this.width, this.height)) this.requestFrame();
    } catch {
      this.fail();
    }
  };
}
