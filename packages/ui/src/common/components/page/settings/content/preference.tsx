import { memo, type FC } from "react";
import { Monitor, Palette } from "lucide-react";
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
    </Card>
  );
};

export default memo(Preference);
