import { cx } from "@emotion/css";
import { memo, type FC, useCallback } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseUser, type NeteaseSettingsModel } from "@/common/netease/models";
import type { CacheStoreCategories } from "@/types/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import Cache from "./cache";
import Device from "./device";
import Quality from "./quality";
import Shortcut from "./shortcut";
import Preference from "./preference";
import Performance from "./performance";

interface SettingsContentProps {
  className?: string;
  refreshSize: NormalFunc;
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettingsModel;
  updateOutput: NormalFunc<[deviceId: string]>;
  cacheStoreSizes: Nullable<CacheStoreCategories>;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"invoke_cache_config_get">>;
  output: { selected: string; views: { deviceId: string; displayName: string }[] };
  updateCacheStoreConfig: PromiseFunc<
    [config: Partial<InvokeEventPayload<"invoke_cache_config_get">>]
  >;
}

const SettingsContent: FC<SettingsContentProps> = ({
  user,
  className,
  output,
  settings,
  refreshSize,
  updateOutput,
  updateSettings,
  cacheStoreSizes,
  cacheStoreConfig,
  updateCacheStoreConfig
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
    <main className={cx("w-full space-y-4 scrollbar scrollbar-show contain-layout", className)}>
      <Quality
        data={settings.trackQuality}
        vip={user?.isVIP() ?? false}
        updateQuality={updateQuality}
      />
      <Device output={output} updateOutput={updateOutput} />
      <Performance data={settings.performance} patchSettings={patchSettings} />
      <Preference data={settings.preference} patchSettings={patchSettings} />
      <Shortcut data={settings.shortcuts} patchSettings={patchSettings} />
      <Cache
        refreshSize={refreshSize}
        cacheStoreSizes={cacheStoreSizes}
        cacheStoreConfig={cacheStoreConfig}
        updateCacheStoreConfig={updateCacheStoreConfig}
      />
    </main>
  );
};

export default memo(SettingsContent);
