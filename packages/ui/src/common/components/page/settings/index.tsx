import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useState } from "react";
import { NeteaseSettings, type NeteaseSettingsModel, NeteaseUser } from "@/common/netease/models";
import { RendererIPC } from "@/common/lib/ipc";
import { RendererCache } from "@/common/lib/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/renderer";

import SettingsAside from "./aside";
import SettingsContent from "./content";
import AppToast from "@/common/components/toast";

interface SettingsProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettings;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  output: { selected: string; views: { displayName: string; deviceId: string }[] };
  updateOutput: NormalFunc<[deviceId: string]>;
  logout: NormalFunc;
  login: NormalFunc;
  className?: string;
}

const Settings: FC<SettingsProps> = ({
  user,
  settings,
  updateSettings,
  className,
  logout,
  login,
  updateOutput,
  output
}) => {
  const [cacheStoreSizes, setCacheStoreSizes] = useState<Nullable<CacheStoreSizeCategories>>(null);
  const [cacheStoreConfig, setCacheStoreConfig] =
    useState<Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>>(null);

  const getCacheStoreConfig = useCallback(async () => {
    const config = await RendererIPC.Invoke("fetchCacheStoreConfig", undefined).catch(() => {
      AppToast.show({
        type: "error",
        text: "加载缓存配置失败"
      });
      return null;
    });
    setCacheStoreConfig(config);
    return config;
  }, []);

  const updateCacheStoreConfig = useCallback(
    async (config: Partial<InvokeEventPayload<"fetchCacheStoreConfig">>) => {
      const res = await RendererIPC.Invoke("updateCacheStoreConfig", config);
      if (res.ok) {
        setCacheStoreConfig(res.config);
      } else {
        AppToast.show({
          type: "error",
          text: res.reason
        });
      }
    },
    []
  );

  const getCacheStoreStatus = useCallback(async () => {
    const status = await RendererCache.local.other.sizeCategories();
    if (status.ok) {
      setCacheStoreSizes(status);
    } else {
      AppToast.show({
        type: "error",
        text: "加载缓存状态失败"
      });
      setCacheStoreSizes(null);
    }
  }, []);

  useEffect(() => {
    void getCacheStoreConfig();
    void getCacheStoreStatus();
  }, [getCacheStoreConfig, getCacheStoreStatus]);

  return (
    <section
      className={cx(
        `
          h-full overflow-y-auto lg:overflow-hidden scrollbar scrollbar-show
          grid grid-cols-1 md:grid-cols-[minmax(260px,0.82fr)_minmax(520px,1.58fr)] gap-4
          lg:scrollbar-hidden
        `,
        className
      )}>
      <SettingsAside
        user={user}
        settings={settings}
        cacheStoreConfig={cacheStoreConfig}
        logout={logout}
        login={login}
      />
      <SettingsContent
        user={user}
        settings={settings}
        output={output}
        updateOutput={updateOutput}
        updateSettings={updateSettings}
        cacheStoreConfig={cacheStoreConfig}
        cacheStoreSizes={cacheStoreSizes}
        updateCacheStoreConfig={updateCacheStoreConfig}
        refreshSize={getCacheStoreStatus}
      />
    </section>
  );
};

export default memo(Settings);
