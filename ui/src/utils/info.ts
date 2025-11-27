import { EqError } from "@mahiru/ui/utils/dev";

export interface GpuDevice {
  active: boolean;
  deviceId: number;
  deviceString: string;
  driverVendor?: string;
  driverVersion: string;
  gpuPreference: number;
  revision: number;
  subSysId: number;
  vendorId: number;
}

export function getGPUDevice() {
  return new Promise<GpuDevice[]>((resolve, reject) => {
    window.node.invoke
      .GPUInfo()
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
