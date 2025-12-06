export type RendererOptions = {
  width: number;
  height: number;
  dpr: number;
  color: string;
  secondaryColor?: string;
  gap: number;
  barWidth?: number;
  roundedCorners?: "top" | "bottom" | "both" | "none";
  heightScale?: number;
};

export interface IRenderer {
  init(canvas: HTMLCanvasElement, options: RendererOptions): void;
  draw(bands: Float32Array): void;
  destroy(): void;
  options?: RendererOptions;
}
