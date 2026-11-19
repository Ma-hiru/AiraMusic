import { memo, type FC } from "react";
import { Monitor, Palette, PanelLeft, FlaskConical } from "lucide-react";
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
        description="从主窗口打开内容（歌单、歌手、专辑等页面）时优先分离到独立窗口。"
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
        icon={PanelLeft}
        title="使用简约版歌单、专辑和歌手页面"
        checked={!!data.useLegacyPlaylistLayout}
        description="以横向头部展示歌单、专辑和歌手，主窗口和展示窗同步生效。"
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
        description="内置曲库查不到 TTML 时，回退到仓库 ttml 分支的补充库；该库带翻译与逐字罗马音，但由脚本抓取生成，可能随时变更。"
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
