import { type FC, memo, useCallback } from "react";
import { type NeteaseSettingsModel, NeteaseUser } from "@/common/netease/models";
import { TrackQuality } from "@/common/enum";

import Cache from "./cache";
import Quality from "./quality";
import Performance from "./performance";
import Preference from "./preference";

interface SettingsContentProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettingsModel;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
}

const SettingsContent: FC<SettingsContentProps> = ({ user, settings, updateSettings }) => {
  const patchSettings = useCallback(
    (patch: Partial<NeteaseSettingsModel>) => {
      updateSettings({
        trackQuality: patch.trackQuality ?? { ...settings.trackQuality },
        performance: patch.performance ?? { ...settings.performance },
        preference: patch.preference ?? { ...settings.preference },
        cache: patch.cache ?? { ...settings.cache }
      });
    },
    [settings, updateSettings]
  );

  const updateQuality = useCallback(
    (next: TrackQuality) => {
      patchSettings({
        trackQuality: {
          ...settings.trackQuality,
          uid: user?.profile.userId ?? settings.trackQuality.uid,
          quality: next
        }
      });
    },
    [patchSettings, settings.trackQuality, user?.profile.userId]
  );

  const updateCache = useCallback(
    (patch: Partial<NeteaseSettingsModel["cache"]>) => {
      patchSettings({
        cache: {
          ...settings.cache,
          ...patch
        }
      });
    },
    [patchSettings, settings.cache]
  );
  return (
    <main className="lg:h-full lg:contain-strict space-y-4 lg:overflow-y-auto scrollbar lg:scrollbar-show">
      <Quality data={settings.trackQuality} updateQuality={updateQuality} />
      <Performance data={settings.performance} patchSettings={patchSettings} />
      <Preference data={settings.preference} patchSettings={patchSettings} />
      <Cache data={settings.cache} updateCache={updateCache} />
    </main>
  );
};

export default memo(SettingsContent);
