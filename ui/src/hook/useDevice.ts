import { Device, GPUDevice } from "@mahiru/ui/utils/device";

const device = await (async () => {
  const [gpu, platform] = await Promise.allSettled([Device.gpu, Device.platform]);
  const device = {
    gpu: { devices: <GPUDevice[]>[], dedicated: false },
    platform: <"unknown" | NodeJS.Platform>"unknown"
  };
  if (gpu.status === "fulfilled") {
    device.gpu = gpu.value;
  }
  if (platform.status === "fulfilled") {
    device.platform = platform.value;
  }
  return device;
})();

export function useDevice() {
  return device;
}
