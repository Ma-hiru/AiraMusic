import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useState } from "react";
import { NeteaseSettings, type NeteaseSettingsModel, NeteaseUser } from "@/common/netease/models";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererCache } from "@/common/lib/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import SettingsAside from "./aside";
import SettingsContent from "./content";
import AppToast from "@/common/components/display/toast";

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
          h-full grid gap-4 overflow-x-hidden contain-layout
          overflow-y-auto md:overflow-y-hidden
          justify-items-center md:justify-items-normal
          grid-cols-1 md:grid-cols-[minmax(120px,1fr)_2fr]
          scrollbar scrollbar-show md:scrollbar-hidden
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
        className="md:h-full md:contain-strict md:overflow-y-auto md:scrollbar-show"
      />
    </section>
  );
};

export default memo(Settings);
