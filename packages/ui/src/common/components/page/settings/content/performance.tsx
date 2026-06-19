import { type FC, memo } from "react";
import { AudioLines, AudioWaveform, Dock, Gauge, Sparkles } from "lucide-react";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";

import ToggleRow from "./toggle-row";
import Card from "@/common/components/layout/card";
import RangeRow from "@/common/components/page/settings/content/range-row";
import BaseGroup from "@/common/components/page/settings/content/base-group";

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
      <BaseGroup
        items={[
          <ToggleRow
            icon={Sparkles}
            title="播放页流体背景"
            description="启用播放页的简单流体背景效果，关闭可以节省性能"
            checked={data.usePlayerFluid}
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
            title="播放页流体背景速度"
            step={1}
            min={1}
            max={10}
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
        expand={data.usePlayerFluid}
      />
      <BaseGroup
        items={[
          <ToggleRow
            icon={Sparkles}
            title="主窗口流体背景"
            description="启用主窗口的简单流体背景效果，关闭可以节省性能"
            checked={data.useHomeFluid}
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
            title="主窗口流体背景速度"
            step={1}
            min={1}
            max={10}
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
        expand={data.useHomeFluid}
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
        unit="FPS"
        step={5}
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
