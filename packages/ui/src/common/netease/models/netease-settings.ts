import { TrackQuality } from "@/common/enum";
import { type ShortcutBindingMap, RendererShortcutConstants } from "@/common/constants/shortcut";

export interface NeteaseSettingsModel {
  shortcuts: ShortcutBindingMap;
  trackQuality: {
    uid: number;
    quality: TrackQuality;
  };
  performance: {
    spectrumFps: number;
    barSpectrum: boolean;
    useHomeFluid: boolean;
    forceCssFluid: boolean;
    homeFluidSpeed: number;
    windowPreload: boolean;
    playerSpectrum: boolean;
    usePlayerFluid: boolean;
    playerFluidSpeed: number;
    homeFluidWithPlaying: boolean;
    playerFluidWithPlaying: boolean;
  };
  preference: {
    useWavePlayerProgress: boolean;
    defaultUseDisplayWindow: boolean;
    useWaveMiniPlayerProgress: boolean;
    /** 使用简约版歌单、专辑和歌手页面，未设置时使用详细版 */
    useLegacyPlaylistLayout?: boolean;
    /**
     * 实验性：amll-ttml-db 查不到时，回退到本仓库 `ttml` 分支的补充库
     * 补充库含翻译与逐字罗马音，但由抓取脚本生成，稳定性未经验证
     */
    useExtraTTML?: boolean;
    /** macOS 菜单栏胶囊：是否显示 */
    trayCapsuleEnabled: boolean;
    /** macOS 菜单栏胶囊：歌词视口宽度（pt） */
    trayCapsuleWidth: number;
  };
}

export const defaultSettings: NeteaseSettingsModel = {
  trackQuality: {
    uid: 0,
    quality: TrackQuality.h
  },
  performance: {
    barSpectrum: true,
    playerSpectrum: true,
    spectrumFps: 30,
    windowPreload: true,
    useHomeFluid: true,
    forceCssFluid: false,
    homeFluidSpeed: 2,
    homeFluidWithPlaying: false,
    usePlayerFluid: true,
    playerFluidSpeed: 2,
    playerFluidWithPlaying: true
  },
  preference: {
    defaultUseDisplayWindow: false,
    useWavePlayerProgress: false,
    useWaveMiniPlayerProgress: true,
    useExtraTTML: false,
    trayCapsuleEnabled: true,
    trayCapsuleWidth: 150
  },
  shortcuts: RendererShortcutConstants.defaultBindings
};

export class NeteaseSettings implements NeteaseSettingsModel {
  trackQuality;
  performance;
  preference;
  shortcuts;

  constructor(props: NeteaseSettingsModel) {
    this.trackQuality = props.trackQuality;
    // 兼容旧版本持久化数据：缺失的性能项回填默认值
    this.performance = { ...defaultSettings.performance, ...props.performance };
    // 兼容旧版本持久化数据：缺失的偏好回填默认值
    this.preference = { ...defaultSettings.preference, ...props.preference };
    // 兼容旧版本持久化数据：缺失的动作回填默认快捷键
    this.shortcuts = { ...RendererShortcutConstants.defaultBindings, ...props.shortcuts };
  }

  static readonly default = new NeteaseSettings(defaultSettings);

  /** 档位 5 对应渲染器的 1 倍速度 */
  static fluidSpeedMultiplier(level: number): number {
    return level / 5;
  }

  static fromObject(settings: NeteaseSettingsModel) {
    return new NeteaseSettings(settings);
  }
}
