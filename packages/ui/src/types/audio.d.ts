type RendererAudioOutputDevice = {
  deviceId: string;
  groupId: string;
  label: string;
  isDefault: boolean;
};

type RendererAudioOutputCategory =
  | "system-default"
  | "speaker-or-headphone"
  | "bluetooth"
  | "usb"
  | "hdmi-displayport"
  | "virtual"
  | "unknown";

type RendererAudioOutputDeviceView = RendererAudioOutputDevice & {
  category: RendererAudioOutputCategory;
  displayName: string;
  hiddenByDefault: boolean;
  priority: number;
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
  audio: RendererSinkableAudioElement;
  context: Nullable<RendererSinkableAudioContext>;
  sinkId?: string;
};
