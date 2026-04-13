import { TrackQuality } from "@mahiru/ui/public/enum";

export class NeteaseSettings implements NeteaseSettingsModel {
  preference: TrackQuality;

  constructor(props: NeteaseSettingsModel) {
    this.preference = props.preference;
  }

  static readonly default = new NeteaseSettings({
    preference: TrackQuality.h
  });

  static fromObject(settings: Optional<NeteaseSettingsModel>) {
    if (!settings) return null;
    return new NeteaseSettings(settings);
  }
}

export interface NeteaseSettingsModel {
  preference: TrackQuality;
}
