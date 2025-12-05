import { IRenderer, RendererOptions } from "./IRenderer";
import { WebGLRenderer as WasmWebGLRenderer } from "@mahiru/wasm";

export class WebGLRendererRust implements IRenderer {
  private renderer: WasmWebGLRenderer | null = null;

  init(canvas: HTMLCanvasElement, options: RendererOptions) {
    this.renderer = new WasmWebGLRenderer(
      canvas,
      options.width,
      options.height,
      options.dpr,
      options.gap,
      options.barWidth ?? undefined
    );
  }

  draw(bands: Float32Array) {
    if (!this.renderer) return;
    const opt = (this as any).options as RendererOptions | undefined;
    if (!opt) return;

    try {
      this.renderer.draw(
        bands,
        opt.color,
        opt.secondaryColor || opt.color,
        opt.roundedCorners || "top"
      );
    } catch (err) {
      console.error("WebGL Rust renderer error:", err);
    }
  }

  destroy() {
    this.renderer = null;
  }
}
