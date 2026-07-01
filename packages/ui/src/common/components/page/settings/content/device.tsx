import { cx } from "@emotion/css";
import { Check, Monitor, ChevronDown } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import Card from "@/common/components/layout/card";

interface DeviceProps {
  updateOutput: NormalFunc<[deviceId: string]>;
  output: { selected: string; views: { deviceId: string; displayName: string }[] };
}

const Device: FC<DeviceProps> = ({ output, updateOutput }) => {
  const [opened, setOpened] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedDevice = useMemo(() => {
    return output.views.find((v) => v.deviceId === output.selected) ?? null;
  }, [output.selected, output.views]);
  const deviceCountText = useMemo(() => {
    if (output.views.length === 0) return "未检测到可用设备";
    return `检测到 ${output.views.length} 个输出设备`;
  }, [output.views.length]);
  const selectedDeviceName =
    selectedDevice?.displayName ??
    (output.views.length === 0 ? "未检测到可用设备" : "当前设备不在列表中");

  const toggleOpened = useCallback(() => {
    if (output.views.length === 0) return;
    setOpened((prev) => !prev);
  }, [output.views.length]);
  const selectDevice = useCallback(
    (deviceId: string) => {
      updateOutput(deviceId);
      setOpened(false);
    },
    [updateOutput]
  );

  useScrollAutoHide(listRef);

  useEffect(() => {
    if (!opened) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) setOpened(false);
    };
    window.addEventListener("click", closeOnOutsideClick);
    return () => window.removeEventListener("click", closeOnOutsideClick);
  }, [opened]);
  useEffect(() => {
    if (output.views.length === 0) setOpened(false);
  }, [output.views.length]);
  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("output");
  }, []);

  return (
    <Card title="播放设备" Icon={Monitor} subTitle="Devices">
      <div
        ref={rootRef}
        className="w-full space-y-3"
        onKeyDown={(event) => event.key === "Escape" && setOpened(false)}>
        <button
          className={cx(
            `
              flex h-16 w-full items-center gap-3 rounded-lg border border-white/15
              bg-white/10 px-3 text-left shadow-sm outline-none
              transition-all duration-300 ease-in-out
              hover:opacity-50 cursor-pointer active:scale-[0.99]
              disabled:cursor-not-allowed disabled:opacity-60
            `,
            opened && "border-(--text-color)! bg-primary! text-(--text-color-on-main)!"
          )}
          type="button"
          title="选择播放设备"
          disabled={output.views.length === 0}
          onClick={toggleOpened}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md">
            <Monitor className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold tracking-widest opacity-50">
              当前输出
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold tracking-normal">
              {selectedDeviceName}
            </span>
          </span>
          <ChevronDown
            className={cx(
              "size-4 shrink-0 transition-transform duration-300 ease-in-out",
              opened && "rotate-180"
            )}
          />
        </button>
        <ul
          ref={listRef}
          className={cx(
            `
            max-h-48 overflow-y-auto rounded-lg border border-white/15
            bg-black/10 p-1 shadow-sm scrollbar scrollbar-show
            transition-all duration-300 ease-in-out space-y-1
          `,
            !opened && "hidden"
          )}
          title="播放设备">
          {output.views.map((device) => {
            const active = output.selected === device.deviceId;
            return (
              <li
                key={device.deviceId}
                className={cx(
                  `
                      flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left
                      text-[12px] font-semibold outline-none cursor-pointer
                      transition-all duration-300 ease-in-out
                       active:scale-[0.98]
                    `,
                  active ? "bg-primary text-primary-text hover:opacity-50" : "hover:bg-white/10"
                )}
                onClick={() => selectDevice(device.deviceId)}>
                <span className="min-w-0 flex-1 truncate">{device.displayName}</span>
                <Check className={cx("size-3.5 shrink-0", !active && "opacity-0")} />
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold opacity-60">
          <span className="min-w-0 truncate">{deviceCountText}</span>
          {selectedDevice && (
            <span className="shrink-0 rounded-md border border-white/15 px-2 py-1 bg-primary text-(--text-color-on-main)">
              正在使用 {selectedDevice.displayName}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default memo(Device);
