import { getGPUDevice, GpuDevice } from "@mahiru/ui/utils/info";
import { useEffect, useState } from "react";

export function useGPU() {
  const [GPUDevices, setGPUDevices] = useState<GpuDevice[]>([]);
  const [hasDedicatedGPU, setHasDedicatedGPU] = useState(false);
  useEffect(() => {
    getGPUDevice().then((devices) => {
      const hasDedicatedGPU = devices.some((device) => {
        return (
          device.active &&
          (device.deviceString.toLowerCase().includes("nvidia") ||
            device.deviceString.toLowerCase().includes("amd"))
        );
      });
      setHasDedicatedGPU(hasDedicatedGPU);
      setGPUDevices(devices);
    });
  }, []);

  return { GPUDevices, hasDedicatedGPU };
}
