import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect, useCallback } from "react";
import { RendererCache } from "@/common/lib/cache";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { NeteaseUser, NeteaseSettings, type NeteaseSettingsModel } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import type { CacheStoreCategories } from "@/types/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import SettingsAside from "./aside";
import SettingsContent, { type SettingsTab } from "./content";

export type { SettingsTab };

const columnClassName =
  "@[45rem]/settings:h-full @[45rem]/settings:contain-strict @[45rem]/settings:overflow-y-auto @[45rem]/settings:scrollbar-show @[45rem]/settings:pr-1";

interface SettingsProps {
  login: NormalFunc;
  tab?: SettingsTab;
  className?: string;
  inDrawer?: boolean;
  logout: NormalFunc;
  routerActive: boolean;
  settings: NeteaseSettings;
  user: Nullable<NeteaseUser>;
  updateOutput: NormalFunc<[deviceId: string]>;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
  output: { selected: string; views: { deviceId: string; displayName: string }[] };
  onTabChange?: NormalFunc<[tab: SettingsTab]>;
}

const Settings: FC<SettingsProps> = ({
  user,
  className,
  onTabChange,
  tab,
  login,
  logout,
  output,
  settings,
  routerActive,
  updateOutput,
  updateSettings,
  inDrawer = false
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

  useAgentFocusCtx({ page: "settings" }, routerActive);

  return (
    <section
      className={cx("h-full min-h-0 [container-name:settings] [container-type:size]", className)}>
      <div
        className="
          grid h-full grid-cols-1 grid-rows-[auto_max-content]
          justify-items-center gap-4 overflow-x-hidden overflow-y-auto
          scrollbar scrollbar-show contain-layout
          @[45rem]/settings:grid-cols-[minmax(120px,1fr)_2fr] @[45rem]/settings:grid-rows-1
          @[45rem]/settings:justify-items-normal @[45rem]/settings:overflow-y-hidden
          @[45rem]/settings:scrollbar-hidden
        ">
        <SettingsAside
          className={columnClassName}
          user={user}
          login={login}
          logout={logout}
          settings={settings}
          showDetails={!inDrawer}
          cacheStoreConfig={cacheStoreConfig}
        />
        <SettingsContent
          className={cx("min-h-[100cqh] @[45rem]/settings:min-h-0", columnClassName)}
          tab={tab}
          user={user}
          output={output}
          settings={settings}
          updateOutput={updateOutput}
          updateSettings={updateSettings}
          cacheStoreSizes={cacheStoreSizes}
          refreshSize={getCacheStoreStatus}
          cacheStoreConfig={cacheStoreConfig}
          updateCacheStoreConfig={updateCacheStoreConfig}
          onTabChange={onTabChange}
        />
      </div>
    </section>
  );
};

export default memo(Settings);
