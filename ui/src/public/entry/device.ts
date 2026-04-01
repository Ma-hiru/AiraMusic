import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { Log } from "@mahiru/ui/public/utils/dev";

export default class Device {
  private static get gpuDevice(): Promise<GPUDevice[]> {
    return AppRenderer.Event.invoke
      .GPUInfo()
      .then((res) => res)
      .then((res) => {
        if (res && typeof res === "object" && "gpuDevice" in res && Array.isArray(res?.gpuDevice)) {
          return res.gpuDevice;
        } else {
          return [];
        }
      })
      .catch((err) => {
        Log.error(err);
        return [];
      });
  }

  static get gpu() {
    const { promise, resolve } = Promise.withResolvers<{
      devices: GPUDevice[];
      dedicated: boolean;
    }>();

    const searchBrand = ["nvidia", "amd"];
    const result = { devices: <GPUDevice[]>[], dedicated: false };
    this.gpuDevice
      .then((devices) => {
        result.devices = devices;
        result.dedicated = devices.some((device) => {
          const name = device.deviceString?.toLowerCase();
          return device.active && searchBrand.find((brand) => name?.includes(brand));
        });
      })
      .catch((err) => Log.error(err))
      .finally(() => resolve(result));

    return promise;
  }

  static get platform(): Promise<NodeJS.Platform | "unknown"> {
    return AppRenderer.Event.invoke.platform().catch((err) => {
      Log.error(err);
      return "unknown";
    });
  }

  static get audio() {
    const { promise, resolve } = Promise.withResolvers<MediaDeviceInfo[]>();

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => devices.filter((d) => d.kind === "audiooutput"))
      .then(resolve)
      .catch(() => resolve([]));

    return promise;
  }

  static async setAudio(audio: HTMLAudioElement, device: MediaDeviceInfo) {
    if (typeof audio.setSinkId !== "function") {
      Log.warn("not support setSinkId");
      return false;
    }
    try {
      await audio.setSinkId(device.deviceId);
      Log.debug("输出设备切换成功: " + device.deviceId);
    } catch (err) {
      Log.error(err);
    }
  }
}

export interface GPUDevice {
  active: boolean;
  deviceId: number;
  deviceString?: string;
  driverVendor?: string;
  driverVersion: string;
  gpuPreference: number;
  revision: number;
  subSysId: number;
  vendorId: number;
}
