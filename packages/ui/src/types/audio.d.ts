type RendererAudioOutputDevice = {
  label: string;
  groupId: string;
  deviceId: string;
  isDefault: boolean;
};

type RendererAudioOutputCategory =
  | "usb"
  | "unknown"
  | "virtual"
  | "bluetooth"
  | "system-default"
  | "hdmi-displayport"
  | "speaker-or-headphone";

type RendererAudioOutputDeviceView = RendererAudioOutputDevice & {
  priority: number;
  displayName: string;
  hiddenByDefault: boolean;
  category: RendererAudioOutputCategory;
};

type RendererSinkableAudioElement = HTMLMediaElement & {
  sinkId?: string;
  setSinkId?: (sinkId: string) => Promise<void>;
};

type RendererAudioSinkId = string | { type: "none" };

type RendererSinkableAudioContext = AudioContext & {
  sinkId?: RendererAudioSinkId;
  setSinkId?: (sinkId: RendererAudioSinkId) => Promise<void>;
};

type RendererAudioOutputTarget = {
  sinkId?: string;
  audio: RendererSinkableAudioElement;
  context: Nullable<RendererSinkableAudioContext>;
};
