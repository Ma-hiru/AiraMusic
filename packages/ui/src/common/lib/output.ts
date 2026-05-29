import { Listenable } from "@/common/utils/listenable";
import { Log } from "@/common/lib/log";

class _RendererOutput extends Listenable {
  readonly DEFAULT_DEVICE_ID = "default";

  private readonly onChange = () => {
    Log.info("deviceChange");
    this.executeListeners();
  };

  constructor() {
    super("RendererOutput");
    if (this.supported()) navigator.mediaDevices.addEventListener("devicechange", this.onChange);
  }

  override [Symbol.dispose]() {
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.onChange);
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

  public currentID(target: RendererAudioOutputTarget) {
    const { audio, context, sinkId } = target;
    return this.readSinkId(context?.sinkId) || sinkId || audio.sinkId || this.DEFAULT_DEVICE_ID;
  }

  async currentDevice(target: RendererAudioOutputTarget) {
    const devices = await this.devices();
    const currentID = this.currentID(target);
    return (
      devices.find((d) => d.deviceId === currentID) ?? devices.find((d) => d.isDefault) ?? null
    );
  }

  async isCurrentAvailable(target: RendererAudioOutputTarget) {
    const currentID = this.currentID(target);
    if (currentID === this.DEFAULT_DEVICE_ID) return true;
    const devices = await this.devices();
    return devices.some((d) => d.deviceId === currentID);
  }

  private isSetting = false;
  async set(target: RendererAudioOutputTarget, deviceId: string) {
    await this.setSinkId(target, deviceId, deviceId);
  }

  async setDefault(target: RendererAudioOutputTarget) {
    try {
      // 空字符串表示 user-agent 默认输出设备。
      await this.setSinkId(target, "", this.DEFAULT_DEVICE_ID);
    } catch {
      // Chromium 的枚举列表也可能暴露 "default" 这个设备 ID。
      await this.setSinkId(target, this.DEFAULT_DEVICE_ID, this.DEFAULT_DEVICE_ID);
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

  private readSinkId(sinkId: Undefinable<RendererAudioSinkId>) {
    return typeof sinkId === "string" && sinkId.length > 0 ? sinkId : undefined;
  }

  private async setSinkId(
    target: RendererAudioOutputTarget,
    apiSinkId: string,
    selectedDeviceId: string
  ) {
    const { audio, context } = target;
    if (!audio.setSinkId && !context?.setSinkId) throw new Error("当前环境不支持切换输出");
    if (this.isSetting) return;
    this.isSetting = true;

    try {
      if (context?.setSinkId) {
        try {
          await context.setSinkId(apiSinkId);
          target.sinkId = selectedDeviceId;
          return;
        } catch (error) {
          throw this.createSinkError(target, selectedDeviceId, error, "AudioContext.setSinkId");
        }
      }
      if (audio.setSinkId) {
        try {
          await audio.setSinkId(apiSinkId);
          target.sinkId = selectedDeviceId;
          return;
        } catch (error) {
          throw this.createSinkError(target, selectedDeviceId, error, "HTMLMediaElement.setSinkId");
        }
      }
    } finally {
      this.isSetting = false;
    }
  }

  private createSinkError(
    target: RendererAudioOutputTarget,
    deviceId: string,
    error: unknown,
    phase: string
  ) {
    return {
      phase,
      deviceId,
      currentSinkId: target.audio.sinkId,
      audioContextSinkId: target.context?.sinkId,
      readyState: target.audio.readyState,
      error,
      name: error instanceof DOMException ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export const RendererOutput = new _RendererOutput();
