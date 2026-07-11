export type RendererOptions = {
  dpr: number;
  gap: number;
  color: string;
  width: number;
  height: number;
  barWidth?: number;
  heightScale?: number;
  secondaryColor?: string;
  roundedCorners?: "top" | "both" | "none" | "bottom";
};

export interface IRenderer {
  destroy(): void;
  options?: RendererOptions;
  draw(bands: Float32Array): void;
  init(canvas: HTMLCanvasElement, options: RendererOptions): void;
}
