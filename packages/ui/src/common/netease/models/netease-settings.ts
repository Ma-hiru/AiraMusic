import { TrackQuality } from "@/common/enum";
import { type ShortcutBindingMap, RendererShortcutConstants } from "@/common/constants/shortcut";

export interface NeteaseSettingsModel {
  shortcuts: ShortcutBindingMap;
  trackQuality: {
    uid: number;
    quality: TrackQuality;
  };
  preference: {
    defaultUseDisplayWindow: boolean;
    /** 使用简约版歌单、专辑和歌手页面，未设置时使用详细版 */
    useLegacyPlaylistLayout?: boolean;
    /** macOS 菜单栏胶囊：是否显示 */
    trayCapsuleEnabled: boolean;
    /** macOS 菜单栏胶囊：歌词视口宽度（pt） */
    trayCapsuleWidth: number;
  };
  performance: {
    spectrumFps: number;
    barSpectrum: boolean;
    useHomeFluid: boolean;
    homeFluidSpeed: number;
    windowPreload: boolean;
    playerSpectrum: boolean;
    usePlayerFluid: boolean;
    playerFluidSpeed: number;
    homeFluidWithPlaying: boolean;
    playerFluidWithPlaying: boolean;
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
    homeFluidSpeed: 7,
    homeFluidWithPlaying: false,
    usePlayerFluid: true,
    playerFluidSpeed: 5,
    playerFluidWithPlaying: true
  },
  preference: {
    defaultUseDisplayWindow: false,
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
    this.performance = props.performance;
    // 兼容旧版本持久化数据：缺失的偏好回填默认值
    this.preference = { ...defaultSettings.preference, ...props.preference };
    // 兼容旧版本持久化数据：缺失的动作回填默认快捷键
    this.shortcuts = { ...RendererShortcutConstants.defaultBindings, ...props.shortcuts };
  }

  static readonly default = new NeteaseSettings(defaultSettings);

  static fromObject(settings: NeteaseSettingsModel) {
    return new NeteaseSettings(settings);
  }
}
