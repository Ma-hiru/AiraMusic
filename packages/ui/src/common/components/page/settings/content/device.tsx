import { type FC, memo } from "react";
import { cx } from "@emotion/css";

import Card from "@/common/components/card";

interface DeviceProps {
  output: { selected: string; views: { displayName: string; deviceId: string }[] };
  updateOutput: NormalFunc<[deviceId: string]>;
}

const device: FC<DeviceProps> = ({ output, updateOutput }) => {
  return (
    <Card title="播放设备" subTitle="Devices">
      <div className="w-full flex flex-col gap-3">
        {output.views.map((v) => {
          return (
            <div
              className={cx(
                `
                  hover:opacity-50 active:scale-95
                  px-2 py-1 text-[12px] font-semibold bg-white/15 rounded-md
                  ease-in-out duration-300 transition-all
                `,
                output.selected === v.deviceId && "bg-white/30"
              )}
              onClick={() => updateOutput(v.deviceId)}>
              {v.displayName}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default memo(device);
