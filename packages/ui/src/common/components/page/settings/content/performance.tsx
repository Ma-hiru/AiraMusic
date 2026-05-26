import { type FC, memo } from "react";
import { AudioLines, AudioWaveform, Dock, Gauge } from "lucide-react";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";

import ToggleRow from "./toggle-row";
import Card from "@/common/components/card";
import RangeRow from "@/common/components/page/settings/content/range-row";

export interface PerformanceSettings {
  data: NeteaseSettings["performance"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Performance: FC<PerformanceSettings> = ({ data, patchSettings }) => {
  return (
    <Card Icon={Gauge} title="性能" subTitle="Performance">
      <ToggleRow
        icon={Dock}
        title="播放栏频谱"
        description="是否展示播放栏的频谱，关闭可以节省性能"
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
      <ToggleRow
        icon={AudioLines}
        title="播放页频谱"
        description="是否展示播放页的频谱，关闭可以节省性能"
        checked={data.playerSpectrum}
        onClick={() =>
          patchSettings({
            performance: {
              ...data,
              playerSpectrum: !data.playerSpectrum
            }
          })
        }
      />
      <RangeRow
        icon={AudioWaveform}
        title="频谱帧率"
        min={15}
        max={60}
        step={5}
        rangeValue={data.spectrumFps}
        value={data.spectrumFps + " FPS"}
        onChange={(value) =>
          patchSettings({
            performance: {
              ...data,
              spectrumFps: value
            }
          })
        }
      />
    </Card>
  );
};

export default memo(Performance);
