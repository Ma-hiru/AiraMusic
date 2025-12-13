import { Device, GPUDevice } from "@mahiru/ui/utils/device";
import { useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";

export function useGPU() {
  const [gpuDevices, setGpuDevices] = useState<GPUDevice[]>([]);
  const [hasDedicatedGPU, setHasDedicatedGPU] = useState(false);
  useEffect(() => {
    Device.gpu
      .then((devices) => {
        const hasDedicatedGPU = devices.some((device) => {
          return (
            device.active &&
            (device.deviceString?.toLowerCase().includes("nvidia") ||
              device.deviceString?.toLowerCase().includes("amd"))
          );
        });
        setHasDedicatedGPU(hasDedicatedGPU);
        setGpuDevices(devices);
      })
      .catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            message: "failed to get gpu devices information",
            label: "hook/useGPU.ts"
          })
        );
      });
  }, []);

  return { gpuDevices, hasDedicatedGPU };
}
