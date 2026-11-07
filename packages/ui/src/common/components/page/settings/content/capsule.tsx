import { memo, type FC } from "react";
import { MoveHorizontal, RectangleHorizontal } from "lucide-react";
import { RendererDevice } from "@/common/lib/device";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";
import Card from "@/common/components/layout/card";

import RangeRow from "./range-row";
import ToggleRow from "./toggle-row";

/** 顶栏胶囊是 macOS 独占能力 */
const isDarwin = (await RendererDevice.platform) === "darwin";

interface CapsuleSettings {
  data: NeteaseSettings["preference"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Capsule: FC<CapsuleSettings> = ({ data, patchSettings }) => {
  if (!isDarwin) return null;

  return (
    <Card title="顶栏胶囊" Icon={RectangleHorizontal} subTitle="Menu Bar Capsule">
      <ToggleRow
        title="显示顶栏胶囊"
        icon={RectangleHorizontal}
        checked={data.trayCapsuleEnabled}
        description="把托盘图标与歌词合并成菜单栏上的一个胶囊：左侧图标、右侧逐字歌词。关闭后菜单栏不再显示。"
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              trayCapsuleEnabled: !data.trayCapsuleEnabled
            }
          })
        }
      />
      {data.trayCapsuleEnabled && (
        <RangeRow
          max={280}
          min={100}
          step={10}
          unit="pt"
          title="歌词区域宽度"
          icon={MoveHorizontal}
          value={data.trayCapsuleWidth}
          onChange={(value) =>
            patchSettings({
              preference: {
                ...data,
                trayCapsuleWidth: value
              }
            })
          }
        />
      )}
    </Card>
  );
};

export default memo(Capsule);
