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

export const Device = new (class {
  get gpu(): Promise<GPUDevice[]> {
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
