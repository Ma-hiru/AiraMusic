import { type FC, memo, useCallback } from "react";
import { type NeteaseSettingsModel, NeteaseUser } from "@/common/netease/models";
import { TrackQuality } from "@/common/enum";
import type { InvokeEventPayload } from "@mahiru/ipc/renderer";

import Cache from "./cache";
import Quality from "./quality";
import Performance from "./performance";
import Preference from "./preference";

interface SettingsContentProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettingsModel;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  cacheStoreSizes: Nullable<CacheStoreSizeCategories>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>;
  updateCacheStoreConfig: PromiseFunc<
    [config: Partial<InvokeEventPayload<"fetchCacheStoreConfig">>]
  >;
}

const SettingsContent: FC<SettingsContentProps> = ({
  user,
  settings,
  updateSettings,
  cacheStoreConfig,
  cacheStoreSizes,
  updateCacheStoreConfig
}) => {
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

  return (
    <main className="lg:h-full lg:contain-strict space-y-4 lg:overflow-y-auto scrollbar lg:scrollbar-show">
      <Quality data={settings.trackQuality} updateQuality={updateQuality} />
      <Performance data={settings.performance} patchSettings={patchSettings} />
      <Preference data={settings.preference} patchSettings={patchSettings} />
      <Cache
        updateCacheStoreConfig={updateCacheStoreConfig}
        cacheStoreConfig={cacheStoreConfig}
        cacheStoreSizes={cacheStoreSizes}
      />
    </main>
  );
};

export default memo(SettingsContent);
