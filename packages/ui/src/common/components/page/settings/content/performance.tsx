import { memo, type FC } from "react";
import { Dock, Gauge, Sparkles, AudioLines, AudioWaveform } from "lucide-react";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";
import Card from "@/common/components/layout/card";
import RangeRow from "@/common/components/page/settings/content/range-row";
import BaseGroup from "@/common/components/page/settings/content/base-group";

import ToggleRow from "./toggle-row";

export interface PerformanceSettings {
  data: NeteaseSettings["performance"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Performance: FC<PerformanceSettings> = ({ data, patchSettings }) => {
  return (
    <Card title="性能" Icon={Gauge} subTitle="Performance">
      <ToggleRow
        icon={Dock}
        title="播放栏频谱"
        checked={data.barSpectrum}
        description="是否展示播放栏的频谱，关闭可以节省性能"
        onClick={() =>
          patchSettings({
            performance: {
              ...data,
              barSpectrum: !data.barSpectrum
            }
          })
        }
      />
      <BaseGroup
        expand={data.usePlayerFluid}
        items={[
          <ToggleRow
            icon={Sparkles}
            title="播放页流体背景"
            checked={data.usePlayerFluid}
            description="启用播放页的简单流体背景效果，关闭可以节省性能"
            onClick={() =>
              patchSettings({
                performance: {
                  ...data,
                  usePlayerFluid: !data.usePlayerFluid
                }
              })
            }
          />,

          <ToggleRow
            title="播放页流体背景跟随音乐"
            description="播放页的简单流体背景是否跟随音乐暂停"
            checked={data.playerFluidWithPlaying}
            onClick={() =>
              patchSettings({
                performance: {
                  ...data,
                  playerFluidWithPlaying: !data.playerFluidWithPlaying
                }
              })
            }
          />,
          <RangeRow
            min={1}
            max={10}
            step={1}
            title="播放页流体背景速度"
            value={data.playerFluidSpeed}
            onChange={(value) =>
              patchSettings({
                performance: {
                  ...data,
                  playerFluidSpeed: value
                }
              })
            }
          />
        ]}
      />
      <BaseGroup
        expand={data.useHomeFluid}
        items={[
          <ToggleRow
            icon={Sparkles}
            title="主窗口流体背景"
            checked={data.useHomeFluid}
            description="启用主窗口的简单流体背景效果，关闭可以节省性能"
            onClick={() =>
              patchSettings({
                performance: {
                  ...data,
                  useHomeFluid: !data.useHomeFluid
                }
              })
            }
          />,
          <ToggleRow
            title="主窗口流体背景跟随音乐"
            description="主窗口的简单流体背景是否跟随音乐暂停"
            checked={data.homeFluidWithPlaying}
            onClick={() =>
              patchSettings({
                performance: {
                  ...data,
                  homeFluidWithPlaying: !data.homeFluidWithPlaying
                }
              })
            }
          />,
          <RangeRow
            min={1}
            max={10}
            step={1}
            title="主窗口流体背景速度"
            value={data.homeFluidSpeed}
            onChange={(value) =>
              patchSettings({
                performance: {
                  ...data,
                  homeFluidSpeed: value
                }
              })
            }
          />
        ]}
      />
      <ToggleRow
        title="播放页频谱"
        icon={AudioLines}
        checked={data.playerSpectrum}
        description="是否展示播放页的频谱，关闭可以节省性能"
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
        max={60}
        min={15}
        step={5}
        unit="FPS"
        title="频谱帧率"
        icon={AudioWaveform}
        value={data.spectrumFps}
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
