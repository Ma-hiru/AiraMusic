import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Renderer } from "@mahiru/ui/utils/renderer";

export interface GpuDevice {
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

class _DevInfo {
  get GPU() {
    return new Promise<GpuDevice[]>((resolve, reject) => {
      Renderer.invoke
        .GPUInfo(undefined)
        .then((res) => res)
        .then((res) => {
          const info = JSON.parse(res);
          const gpuDevice: GpuDevice[] = info?.gpuDevice;
          if (gpuDevice) {
            resolve(gpuDevice);
          } else {
            reject(
              new EqError({
                message: `GPU device info get fail.`,
                label: "ui/info.ts:getGPUDevice"
              })
            );
          }
        })
        .catch(reject);
    });
  }

  get Platform(): Promise<NodeJS.Platform | "unknown"> {
    return Renderer.invoke.platform(undefined).catch((err) => {
      Log.error(
        new EqError({
          raw: err,
          message: `Get platform fail.`,
          label: "ui/info.ts:getPlatform"
        })
      );
      return "unknown";
    });
  }
}

export const DevInfo = new _DevInfo();
