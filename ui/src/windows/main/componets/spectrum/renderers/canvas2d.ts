import { IRenderer, RendererOptions } from "./IRenderer";

export class Canvas2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  options?: RendererOptions;

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
    const {
      width,
      height,
      color,
      gap,
      barWidth,
      secondaryColor,
      roundedCorners = "top",
      heightScale = 1
    } = opt;
    ctx.clearRect(0, 0, width, height);
    const count = bands.length;
    const gapCount = Math.max(0, count - 1);
    const preferredGap = Math.max(0, gap);
    const hasExplicitBarWidth = typeof barWidth === "number" && barWidth > 0;
    const preferredBarWidth = hasExplicitBarWidth
      ? (barWidth as number)
      : Math.max(1, (width - preferredGap * gapCount) / Math.max(1, count));

    const preferredTotalWidth = preferredBarWidth * count + preferredGap * gapCount;
    let computedBarWidth = preferredBarWidth;
    let computedGap = preferredGap;

    // Respect configured gap as the preferred spacing; only compress when overflowing.
    if (gapCount > 0) {
      if (preferredTotalWidth > width && preferredTotalWidth > 0) {
        const scale = width / preferredTotalWidth;
        computedBarWidth = Math.max(0.5, preferredBarWidth * scale);
        computedGap = preferredGap * scale;
      } else if (preferredTotalWidth < width) {
        computedBarWidth = (width - preferredGap * gapCount) / count;
      }
    } else {
      computedBarWidth = width;
    }

    for (let i = 0; i < count; i++) {
      const value = bands[i] ?? 0;
      const enhanced = Math.pow(Math.min(1, Math.max(0, value)), 0.9);
      const barHeight = Math.max(2, enhanced * height * heightScale);
      const x = i * (computedBarWidth + computedGap);
      const drawBarWidth = i === count - 1 ? Math.max(0.5, width - x) : computedBarWidth;
      const y = height - barHeight;
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.6, color);
      gradient.addColorStop(1, secondaryColor || color);
      ctx.fillStyle = gradient;
      const radius = Math.min(3, Math.floor(drawBarWidth / 2), Math.floor(barHeight / 2));

      let radii: number[];
      if (roundedCorners === "both") {
        radii = [radius, radius, radius, radius];
      } else if (roundedCorners === "bottom") {
        radii = [0, 0, radius, radius];
      } else if (roundedCorners === "none") {
        radii = [0, 0, 0, 0];
      } else {
        // "top"
        radii = [radius, radius, 0, 0];
      }

      if (radii.some((r) => r > 0) && typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(x, y, drawBarWidth, barHeight, radii);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, drawBarWidth, barHeight);
      }
    }
  }

  destroy() {
    this.ctx = null;
    this.options = undefined;
  }
}
