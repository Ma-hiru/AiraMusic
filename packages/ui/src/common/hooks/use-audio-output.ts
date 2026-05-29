import AppToast from "@/common/components/toast";
import { Log } from "@/common/lib/log";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererOutput } from "@/common/lib/output";
import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";

export function useAudioOutput(audio: HTMLAudioElement) {
  const output = useListenable(RendererOutput);
  const [views, setViews] = useState<RendererAudioOutputDeviceView[]>([]);
  const [selected, setSelected] = useState(output.DEFAULT_DEVICE_ID);
  const selectedRef = useLatestRef(selected);

  const setDevice = useRef((view: RendererAudioOutputDeviceView | string) => {
    if (typeof view === "string") setSelected(view);
    else setSelected(view.deviceId);
  }).current;

  useEffect(() => {
    output
      .views()
      .then(async (views) => {
        if (!views.find((v) => v.deviceId === selectedRef.current)) {
          setSelected(output.DEFAULT_DEVICE_ID);
        }
        return views;
      })
      .then(setViews);
  }, [
    audio,
    selectedRef,
    output,
    /** 内部变化，不体现在对象身上，需再次获取列表才知道是否现有的设备改变 */
    output._innerCount
  ]);

  // 自动切换音频设备
  useEffect(() => {
    if (output.currentID(audio) === selected) return;

    let promise;
    if (selected === output.DEFAULT_DEVICE_ID) {
      promise = output.setDefault(audio);
    } else {
      promise = output.set(audio, selected);
    }
    promise.catch((err) => {
      Log.error("useAudioOutput", err);
      AppToast.show({
        type: "error",
        text: "切换音频设备失败"
      });
    });
  }, [audio, output, selected]);

  return {
    views,
    selected,
    setDevice
  };
}
