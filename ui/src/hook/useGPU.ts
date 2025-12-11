import { DevInfo, GpuDevice } from "@mahiru/ui/utils/info";
import { useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";

export function useGPU() {
  const [GPUDevices, setGPUDevices] = useState<GpuDevice[]>([]);
  const [hasDedicatedGPU, setHasDedicatedGPU] = useState(false);
  useEffect(() => {
    DevInfo.GPU.then((devices) => {
      const hasDedicatedGPU = devices.some((device) => {
        return (
          device.active &&
          (device.deviceString?.toLowerCase().includes("nvidia") ||
            device.deviceString?.toLowerCase().includes("amd"))
        );
      });
      setHasDedicatedGPU(hasDedicatedGPU);
      setGPUDevices(devices);
    }).catch((err) => {
      Log.error(
        new EqError({
          raw: err,
          message: "failed to get GPU device information",
          label: "hook/useGPU.ts"
        })
      );
    });
  }, []);

  return { GPUDevices, hasDedicatedGPU };
}
