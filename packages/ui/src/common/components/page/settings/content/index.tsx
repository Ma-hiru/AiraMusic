import { type FC, memo, useCallback } from "react";
import { type NeteaseSettingsModel, NeteaseUser } from "@/common/netease/models";
import { TrackQuality } from "@/common/enum";
import type { InvokeEventPayload } from "@mahiru/ipc/renderer";

import Cache from "./cache";
import Quality from "./quality";
import Performance from "./performance";
import Preference from "./preference";
import Shortcut from "./shortcut";
import Device from "./device";

interface SettingsContentProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettingsModel;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  output: { selected: string; views: { displayName: string; deviceId: string }[] };
  updateOutput: NormalFunc<[deviceId: string]>;
  cacheStoreSizes: Nullable<CacheStoreSizeCategories>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>;
  updateCacheStoreConfig: PromiseFunc<
    [config: Partial<InvokeEventPayload<"fetchCacheStoreConfig">>]
  >;
  refreshSize: NormalFunc;
}

const SettingsContent: FC<SettingsContentProps> = ({
  user,
  settings,
  updateSettings,
  cacheStoreConfig,
  cacheStoreSizes,
  updateCacheStoreConfig,
  output,
  updateOutput,
  refreshSize
}) => {
  const patchSettings = useCallback(
    (patch: Partial<NeteaseSettingsModel>) => {
      updateSettings({
        trackQuality: patch.trackQuality ?? { ...settings.trackQuality },
        performance: patch.performance ?? { ...settings.performance },
        preference: patch.preference ?? { ...settings.preference },
        shortcuts: patch.shortcuts ?? { ...settings.shortcuts }
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
      <Quality
        vip={user?.isVIP() ?? false}
        data={settings.trackQuality}
        updateQuality={updateQuality}
      />
      <Device output={output} updateOutput={updateOutput} />
      <Performance data={settings.performance} patchSettings={patchSettings} />
      <Preference data={settings.preference} patchSettings={patchSettings} />
      <Shortcut data={settings.shortcuts} patchSettings={patchSettings} />
      <Cache
        updateCacheStoreConfig={updateCacheStoreConfig}
        cacheStoreConfig={cacheStoreConfig}
        cacheStoreSizes={cacheStoreSizes}
        refreshSize={refreshSize}
      />
    </main>
  );
};

export default memo(SettingsContent);
