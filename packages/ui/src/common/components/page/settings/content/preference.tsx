import { memo, type FC } from "react";
import { Monitor, Palette, PanelLeft, FlaskConical, AudioWaveform } from "lucide-react";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";
import Card from "@/common/components/layout/card";

import ToggleRow from "./toggle-row";

interface PreferenceSettings {
  data: NeteaseSettings["preference"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Preference: FC<PreferenceSettings> = ({ data, patchSettings }) => {
  return (
    <Card title="偏好" Icon={Palette} subTitle="Preference">
      <ToggleRow
        icon={Monitor}
        title="默认使用展示窗"
        checked={data.defaultUseDisplayWindow}
        description="从主窗口打开内容（歌单、歌手、专辑等页面）时优先分离到独立窗口"
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              defaultUseDisplayWindow: !data.defaultUseDisplayWindow
            }
          })
        }
      />
      <ToggleRow
        title="播放页波形进度条"
        icon={AudioWaveform}
        description="在全屏播放页显示随播放起伏的进度条"
        checked={data.useWavePlayerProgress}
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              useWavePlayerProgress: !data.useWavePlayerProgress
            }
          })
        }
      />
      <ToggleRow
        title="迷你播放器波形进度条"
        icon={AudioWaveform}
        description="在迷你播放器显示随播放起伏的进度条"
        checked={data.useWaveMiniPlayerProgress}
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              useWaveMiniPlayerProgress: !data.useWaveMiniPlayerProgress
            }
          })
        }
      />
      <ToggleRow
        icon={PanelLeft}
        title="使用简约版歌单、专辑和歌手页面"
        checked={!!data.useLegacyPlaylistLayout}
        description="以横向头部展示歌单、专辑和歌手，主窗口和展示窗同步生效"
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              useLegacyPlaylistLayout: !data.useLegacyPlaylistLayout
            }
          })
        }
      />
      <ToggleRow
        icon={FlaskConical}
        title="使用自建 TTML 补充歌词库（实验性）"
        checked={!!data.useExtraTTML}
        description="amll-ttml-db 查不到 TTML 时，使用由脚本抓取生成 TTML，效果不一定理想，可在主窗口歌词最下方单独重置某首歌曲的歌词"
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              useExtraTTML: !data.useExtraTTML
            }
          })
        }
      />
    </Card>
  );
};

export default memo(Preference);
