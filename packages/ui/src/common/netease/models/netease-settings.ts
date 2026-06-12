import { TrackQuality } from "@/common/enum";

export interface NeteaseSettingsModel {
  trackQuality: {
    uid: number;
    quality: TrackQuality;
  };
  performance: {
    barSpectrum: boolean;
    playerSpectrum: boolean;
    spectrumFps: number;
    windowPreload: boolean;
    usePlayerFluid: boolean;
    useHomeFluid: boolean;
  };
  preference: {
    defaultUseDisplayWindow: boolean;
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
    usePlayerFluid: true
  },
  preference: {
    defaultUseDisplayWindow: false
  }
};

export class NeteaseSettings implements NeteaseSettingsModel {
  trackQuality;
  performance;
  preference;

  constructor(props: NeteaseSettingsModel) {
    this.trackQuality = props.trackQuality;
    this.performance = props.performance;
    this.preference = props.preference;
  }

  static readonly default = new NeteaseSettings(defaultSettings);

  static fromObject(settings: NeteaseSettingsModel) {
    return new NeteaseSettings(settings);
  }
}
