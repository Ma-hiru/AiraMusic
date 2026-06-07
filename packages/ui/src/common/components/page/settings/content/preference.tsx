import { type FC, memo } from "react";
import { Monitor, Palette } from "lucide-react";
import { NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";

import ToggleRow from "./toggle-row";
import Card from "@/common/components/layout/card";

interface PreferenceSettings {
  data: NeteaseSettings["preference"];
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const Preference: FC<PreferenceSettings> = ({ data, patchSettings }) => {
  return (
    <Card Icon={Palette} title="偏好" subTitle="Preference">
      <ToggleRow
        icon={Monitor}
        title="默认使用展示窗"
        description="从主窗口打开内容（歌单、歌手、专辑等页面）时优先分离到独立窗口。"
        checked={data.defaultUseDisplayWindow}
        onClick={() =>
          patchSettings({
            preference: {
              ...data,
              defaultUseDisplayWindow: !data.defaultUseDisplayWindow
            }
          })
        }
      />
    </Card>
  );
};

export default memo(Preference);
