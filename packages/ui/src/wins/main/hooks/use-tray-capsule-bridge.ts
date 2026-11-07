import { useEffect } from "react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererDevice } from "@/common/lib/device";
import { useSettings } from "@/common/store/settings";

/** 平台只查一次，避免每次设置变化都走一次 invoke */
const platform = RendererDevice.platform;

/**
 * @desc 把设置里的「顶栏胶囊」开关与宽度同步给主进程（仅 macOS） \
 * 主进程收到后下发给原生状态栏项；设置本身仍由 settings store 持久化
 */
export function useTrayCapsuleBridge() {
  const { trayCapsuleWidth, trayCapsuleEnabled } = useSettings().preference;

  useEffect(() => {
    void platform.then((value) => {
      if (value !== "darwin") return;
      RendererIPC.NormalChannel.send("event_tray_capsule", {
        enabled: trayCapsuleEnabled,
        width: trayCapsuleWidth
      });
    });
  }, [trayCapsuleEnabled, trayCapsuleWidth]);
}
