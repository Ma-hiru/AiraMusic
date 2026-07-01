import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect, useCallback } from "react";
import { RendererCache } from "@/common/lib/cache";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { NeteaseUser, NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import type { CacheStoreCategories } from "@/types/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import SettingsAside from "./aside";
import SettingsContent from "./content";

interface SettingsProps {
  login: NormalFunc;
  className?: string;
  logout: NormalFunc;
  settings: NeteaseSettings;
  user: Nullable<NeteaseUser>;
  updateOutput: NormalFunc<[deviceId: string]>;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  output: { selected: string; views: { deviceId: string; displayName: string }[] };
}

const Settings: FC<SettingsProps> = ({
  user,
  className,
  login,
  logout,
  output,
  settings,
  updateOutput,
  updateSettings
}) => {
  const [cacheStoreSizes, setCacheStoreSizes] = useState<Nullable<CacheStoreCategories>>(null);
  const [cacheStoreConfig, setCacheStoreConfig] =
    useState<Nullable<InvokeEventPayload<"invoke_cache_config_get">>>(null);

  const getCacheStoreConfig = useCallback(async () => {
    const config = await RendererIPC.NormalChannel.send("invoke_cache_config_get", undefined).catch(
      () => {
        AppToast.show({
          type: "error",
          text: "加载缓存配置失败"
        });
        return null;
      }
    );
    setCacheStoreConfig(config);
    return config;
  }, []);

  const updateCacheStoreConfig = useCallback(
    async (config: Partial<InvokeEventPayload<"invoke_cache_config_get">>) => {
      const res = await RendererIPC.NormalChannel.send("invoke_cache_config_update", config);
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
    const status = await RendererCache.service.other.categories();
    if (status.code === 200) {
      setCacheStoreSizes(status.data);
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
          h-full grid gap-4 overflow-x-hidden contain-layout
          overflow-y-auto md:overflow-y-hidden
          justify-items-center md:justify-items-normal
          grid-cols-1 md:grid-cols-[minmax(120px,1fr)_2fr]
          scrollbar scrollbar-show md:scrollbar-hidden
        `,
        className
      )}>
      <SettingsAside
        className="md:h-full md:contain-strict md:overflow-y-auto md:scrollbar-show md:pr-1"
        user={user}
        login={login}
        logout={logout}
        settings={settings}
        cacheStoreConfig={cacheStoreConfig}
      />
      <SettingsContent
        className="md:h-full md:contain-strict md:overflow-y-auto md:scrollbar-show md:pr-1"
        user={user}
        output={output}
        settings={settings}
        updateOutput={updateOutput}
        updateSettings={updateSettings}
        cacheStoreSizes={cacheStoreSizes}
        refreshSize={getCacheStoreStatus}
        cacheStoreConfig={cacheStoreConfig}
        updateCacheStoreConfig={updateCacheStoreConfig}
      />
    </section>
  );
};

export default memo(Settings);
