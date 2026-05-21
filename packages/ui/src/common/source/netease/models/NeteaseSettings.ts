import { TrackQuality } from "@mahiru/ui/common/enum";

export interface NeteaseSettingsModel {
  trackQuality: {
    uid: number;
    quality: TrackQuality;
  };
  performance: {
    barSpectrum: boolean;
  };
  window: {
    defaultUseDisplayWindow: boolean;
  };
  cache: {
    maxCacheSize: number;
    maxCacheTime: number;
    cachePath: string;
  };
}

export const defaultSettings: NeteaseSettingsModel = {
  trackQuality: {
    uid: 0,
    quality: TrackQuality.h
  },
  performance: {
    barSpectrum: true
  },
  cache: {
    maxCacheSize: 1024 * 1024 * 1024 * 5, // 5GB
    maxCacheTime: 7 * 24 * 60 * 60 * 1000, // 7天
    cachePath: ""
  },
  window: {
    defaultUseDisplayWindow: false
  }
};

export class NeteaseSettings implements NeteaseSettingsModel {
  trackQuality;
  performance;
  cache;
  window;

  constructor(props: NeteaseSettingsModel) {
    this.trackQuality = props.trackQuality;
    this.performance = props.performance;
    this.cache = props.cache;
    this.window = props.window;
  }

  static readonly default = new NeteaseSettings(defaultSettings);

  static fromObject(settings: NeteaseSettingsModel) {
    return new NeteaseSettings(settings);
  }
}
