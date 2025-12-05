import { IRenderer, RendererOptions } from "./IRenderer";

export class Canvas2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private options: RendererOptions | null = null;

  init(canvas: HTMLCanvasElement, options: RendererOptions) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas2DRenderer: 2D context unavailable");
    this.ctx = ctx;
    this.options = options;
    canvas.width = Math.max(1, Math.floor(options.width * options.dpr));
    canvas.height = Math.max(1, Math.floor(options.height * options.dpr));
    ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  }

  draw(bands: Float32Array) {
    const ctx = this.ctx;
    const opt = this.options;
    if (!ctx || !opt) return;
    const { width, height, color, gap, barWidth, secondaryColor } = opt;
    ctx.clearRect(0, 0, width, height);
    const count = bands.length;
    const totalGap = gap * Math.max(0, count - 1);
    let computedBarWidth: number;
    if (typeof barWidth === "number" && barWidth > 0) {
      computedBarWidth = Math.max(1, Math.floor(barWidth));
    } else {
      const availableWidth = Math.max(1, width - totalGap);
      computedBarWidth = Math.max(2, Math.floor(availableWidth / count));
    }
    for (let i = 0; i < count; i++) {
      const value = bands[i] ?? 0;
      const enhanced = Math.pow(Math.min(1, Math.max(0, value)), 0.9);
      const barHeight = Math.max(2, enhanced * height);
      const x = i * (computedBarWidth + gap);
      const y = height - barHeight;
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.6, color);
      gradient.addColorStop(1, secondaryColor);
      ctx.fillStyle = gradient;
      const radius = Math.min(3, Math.floor(computedBarWidth / 2), Math.floor(barHeight / 2));
      if (radius > 0 && typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(x, y, computedBarWidth, barHeight, [radius, radius, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, computedBarWidth, barHeight);
      }
    }
  }

  destroy() {
    this.ctx = null;
    this.options = null;
  }
}
