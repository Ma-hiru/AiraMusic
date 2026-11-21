/**
 * Material You（Monet）调色盘的共享类型与 CSS 色阶注入。
 *
 * 该模块刻意不引入 material-color-utilities：
 * 取色算法运行在 worker 里，主线程只负责把结果铺成 CSS 变量。
 */

/** 与 worker 取色保持一致的色调阶（HCT Tone，0 黑 → 100 白） */
export const MONET_TONES = [0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 99, 100] as const;

export type MonetTone = (typeof MONET_TONES)[number];

/** 六组基础色板，与 Material 3 CorePalette 一致 */
export const MONET_PALETTES = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error"
] as const;

export type MonetPaletteName = (typeof MONET_PALETTES)[number];

/** 色板名 → CSS 变量中缀（neutralVariant → neutral-variant） */
const PALETTE_CSS_NAME: Record<MonetPaletteName, string> = {
  primary: "primary",
  secondary: "secondary",
  tertiary: "tertiary",
  neutral: "neutral",
  neutralVariant: "neutral-variant",
  error: "error"
};

/** 未提供独立主色时，沿用 palette.css 的默认色阶。 */
export const MONET_ACCENT_TONE: MonetTone = 60;
const MONET_ACCENT_ROLES = ["fill", "ink", "hover", "active"] as const;

export type TonalColors = Record<MonetTone, string>;

/** 六组色板构成的完整调色盘，可跨窗口传输 */
export type MonetPalettes = Record<MonetPaletteName, TonalColors> & {
  accent?: Record<(typeof MONET_ACCENT_ROLES)[number], string>;
};

export interface ImageColors {
  /** CSS 背景使用的封面候选色，独立于 UI 色阶。 */
  coverColors: string[];
  /** 六组完整色板 */
  palettes: MonetPalettes;
}

export interface MonetExtractOptions {
  /** 最大采样边长，默认 128 */
  maxDimension?: number;
}

/** 主线程 → worker */
export interface MonetWorkerRequest {
  id: number;
  url: string;
  maxDimension: number;
}

/** worker → 主线程 */
export type MonetWorkerResult =
  | { id: number; error: string; type: "error" }
  | { id: number; type: "palette"; colors: ImageColors };

/** 用封面色阶覆盖默认值，语义角色由 palette.css 统一映射。 */
export function applyMonetPalette(
  palettes: Nullable<MonetPalettes>,
  style = document.documentElement.style
) {
  const setColor = (name: string, color = "") => {
    if (style.getPropertyValue(name) === color) return;
    if (color) style.setProperty(name, color);
    else style.removeProperty(name);
  };

  for (const palette of MONET_PALETTES) {
    for (const tone of MONET_TONES) {
      setColor(`--m3-${PALETTE_CSS_NAME[palette]}-${tone}`, palettes?.[palette]?.[tone]);
    }
  }
  for (const role of MONET_ACCENT_ROLES) {
    setColor(`--m3-accent-${role}`, palettes?.accent?.[role]);
  }
}
