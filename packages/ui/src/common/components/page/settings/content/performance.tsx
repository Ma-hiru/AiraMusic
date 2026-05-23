import { type FC, memo } from "react";
import { AudioLines, Gauge } from "lucide-react";
import {
  NeteaseSettings,
  type NeteaseSettingsModel
} from "@mahiru/ui/common/source/netease/models";

import ToggleRow from "./toggle-row";
import Card from "@mahiru/ui/common/components/card/Card";

export interface PerformanceSettings {
  data: NeteaseSettings["performance"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Performance: FC<PerformanceSettings> = ({ data, patchSettings }) => {
  return (
    <Card Icon={Gauge} title="性能" subTitle="Performance">
      <ToggleRow
        icon={AudioLines}
        title="播放栏频谱"
        description="让底部播放栏跟着音乐轻微呼吸。"
        checked={data.barSpectrum}
        onClick={() =>
          patchSettings({
            performance: {
              ...data,
              barSpectrum: !data.barSpectrum
            }
          })
        }
      />
    </Card>
  );
};

export default memo(Performance);
