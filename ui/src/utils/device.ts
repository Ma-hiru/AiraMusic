import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Renderer } from "@mahiru/ui/utils/renderer";

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

export const Device = new (class Device {
  private get gpuDevice(): Promise<GPUDevice[]> {
    return Renderer.invoke
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
        Log.error(
          new EqError({
            raw: err,
            message: "get gpu devices fail",
            label: "utils/info.ts"
          })
        );
        return [];
      });
  }
  get gpu() {
    return new Promise<{ devices: GPUDevice[]; dedicated: boolean }>((resolve) => {
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
        .catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              message: "failed to get gpu devices information",
              label: "hook/useGPU.ts"
            })
          );
        })
        .finally(() => {
          resolve(result);
        });
    });
  }
  get platform(): Promise<NodeJS.Platform | "unknown"> {
    return Renderer.invoke.platform().catch((err) => {
      Log.error(
        new EqError({
          raw: err,
          message: "get gpu devices fail",
          label: "utils/info.ts"
        })
      );
      return "unknown";
    });
  }
})();
