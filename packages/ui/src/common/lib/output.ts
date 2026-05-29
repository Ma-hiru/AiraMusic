import { Listenable } from "@/common/utils/listenable";
import { Log } from "@/common/lib/log";

class _RendererOutput extends Listenable {
  readonly DEFAULT_DEVICE_ID = "default";

  private onChange() {
    Log.info("deviceChange");
    this.executeListeners();
  }

  constructor() {
    super("RendererOutput");
    if (this.supported()) navigator.mediaDevices.addEventListener("devicechange", this.onChange);
  }

  override [Symbol.dispose]() {
    navigator.mediaDevices.removeEventListener("devicechange", this.onChange);
    super[Symbol.dispose]();
  }

  public supported() {
    return Boolean(navigator.mediaDevices?.enumerateDevices);
  }

  async devices(): Promise<RendererAudioOutputDevice[]> {
    if (!this.supported()) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audiooutput")
      .map((d) => {
        const label = d.label?.trim() || "Unknown audio output";
        return {
          label,
          groupId: d?.groupId ?? "",
          deviceId: d?.deviceId ?? "",
          isDefault: (d?.deviceId ?? "").toLowerCase() === this.DEFAULT_DEVICE_ID
        } satisfies RendererAudioOutputDevice;
      })
      .sort((a, b) => {
        // 默认置顶
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.label.localeCompare(b.label);
      });
  }

  async views(): Promise<RendererAudioOutputDeviceView[]> {
    const devices = await this.devices();
    return devices
      .map((device) => this.toView(device))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.displayName.localeCompare(b.displayName);
      });
  }

  async default() {
    const devices = await this.devices();
    return devices.find((d) => d.isDefault) ?? devices[0] ?? null;
  }

  public currentID(audio: RendererSinkableAudioElement) {
    return audio.sinkId || this.DEFAULT_DEVICE_ID;
  }

  async currentDevice(audio: RendererSinkableAudioElement) {
    const devices = await this.devices();
    const currentID = this.currentID(audio);
    return (
      devices.find((d) => d.deviceId === currentID) ?? devices.find((d) => d.isDefault) ?? null
    );
  }

  async isCurrentAvailable(audio: RendererSinkableAudioElement) {
    const currentID = this.currentID(audio);
    if (currentID === this.DEFAULT_DEVICE_ID) return true;
    const devices = await this.devices();
    return devices.some((d) => d.deviceId === currentID);
  }

  async set(audio: RendererSinkableAudioElement, deviceId: string) {
    if (!audio.setSinkId) {
      throw new Error("当前环境不支持 setSinkId");
    }

    try {
      await audio.setSinkId(deviceId);
    } catch (error) {
      console.error("[RendererOutput.setSinkId failed]", {
        deviceId,
        currentSinkId: audio.sinkId,
        readyState: audio.readyState,
        error,
        name: error instanceof DOMException ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  async setDefault(audio: RendererSinkableAudioElement) {
    if (!audio.setSinkId) throw new Error("当前环境不支持切换输出");
    try {
      // 规空字符串表示 user-agent 默认输出设备
      await audio.setSinkId("");
    } catch {
      // 可用写法
      await audio.setSinkId(this.DEFAULT_DEVICE_ID);
    }
  }

  public toView(device: RendererAudioOutputDevice): RendererAudioOutputDeviceView {
    const category = this.classify(device);
    return {
      ...device,
      category,
      displayName: this.displayName(device, category),
      hiddenByDefault: this.shouldHideByDefault(category),
      priority: this.priority(category)
    };
  }

  private classify(device: RendererAudioOutputDevice): RendererAudioOutputCategory {
    if (device.isDefault) return "system-default";
    const label = device.label;
    if (/bluetooth|蓝牙/i.test(label)) return "bluetooth";
    if (/\bUSB\b/i.test(label)) return "usb";
    if (/HDMI|DisplayPort|\bDP\b/i.test(label)) return "hdmi-displayport";
    if (
      /virtual|loopback|monitor|blackhole|soundflower|vb-audio|cable input|cable output|null output/i.test(
        label
      )
    )
      return "virtual";
    if (/speaker|speakers|headphone|headphones|headset|扬声器|耳机/i.test(label))
      return "speaker-or-headphone";
    return "unknown";
  }

  private displayName(device: RendererAudioOutputDevice, category: RendererAudioOutputCategory) {
    const label = device.label;
    switch (category) {
      case "system-default":
        return "系统默认";
      case "speaker-or-headphone":
        if (/speaker.*headphone|headphone.*speaker/i.test(label)) return "扬声器 / 耳机";
        if (/headphone|headphones|headset|耳机/i.test(label)) return "耳机";
        if (/speaker|speakers|扬声器/i.test(label)) return "扬声器";
        return label;
      case "hdmi-displayport":
        return `外接显示器音频：${label}`;
      case "virtual":
        return `虚拟音频设备：${label}`;
      case "bluetooth":
      case "usb":
      case "unknown":
      default:
        return label;
    }
  }

  private shouldHideByDefault(category: RendererAudioOutputCategory) {
    return category === "hdmi-displayport" || category === "virtual" || category === "unknown";
  }

  private priority(category: RendererAudioOutputCategory) {
    switch (category) {
      case "system-default":
        return 0;
      case "speaker-or-headphone":
        return 1;
      case "bluetooth":
        return 2;
      case "usb":
        return 3;
      case "hdmi-displayport":
        return 10;
      case "virtual":
        return 11;
      case "unknown":
        return 12;
    }
  }
}

export const RendererOutput = new _RendererOutput();
