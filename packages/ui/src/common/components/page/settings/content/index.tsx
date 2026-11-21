import { cx } from "@emotion/css";
import { memo, useRef, type FC, useState, useCallback, useLayoutEffect } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseUser, type NeteaseSettingsModel } from "@/common/netease/models";
import type { CacheStoreCategories } from "@/types/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import Cache from "./cache";
import Device from "./device";
import Capsule from "./capsule";
import Quality from "./quality";
import Shortcut from "./shortcut";
import AgentSettings from "./agent";
import Preference from "./preference";
import Performance from "./performance";

export type SettingsTab = "agent" | "general";

interface SettingsContentProps {
  tab?: SettingsTab;
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
  onTabChange?: NormalFunc<[tab: SettingsTab]>;
}

const SettingsContent: FC<SettingsContentProps> = ({
  user,
  className,
  onTabChange,
  tab,
  output,
  settings,
  refreshSize,
  updateOutput,
  updateSettings,
  cacheStoreSizes,
  cacheStoreConfig,
  updateCacheStoreConfig
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const [selectedTab, setSelectedTab] = useState<SettingsTab>("general");
  const activeTab = tab ?? selectedTab;

  useLayoutEffect(() => {
    const content = contentRef.current;
    const viewport = content?.parentElement;
    if (!content || !viewport) return;
    content.scrollTop = 0;
    // 窄布局共用外层滚动容器，已吸顶时从新分类顶部开始，保留标签栏的位置。
    if (viewport.scrollTop > content.offsetTop) viewport.scrollTop = content.offsetTop;
  }, [activeTab]);

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
    <main
      ref={contentRef}
      className={cx("w-full space-y-4 scrollbar scrollbar-show contain-layout", className)}>
      <div className="sticky top-0 z-20 flex justify-center py-1 @[45rem]/settings:justify-start">
        <div
          className="surface-1 inline-flex rounded-lg border border-ink/[0.07] p-1 shadow-lg shadow-black/10 backdrop-blur-xl"
          role="tablist"
          aria-label="设置分类">
          {(
            [
              ["general", "常规设置"],
              ["agent", "Agent"]
            ] as const
          ).map(([value, label]) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                className={cx(
                  "min-w-24 rounded-md px-3 py-1.5 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/35",
                  active ? "bg-primary text-primary-text" : "text-ink/42 hover:bg-ink/[0.06]"
                )}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  if (active) return;
                  if (tab === undefined) setSelectedTab(value);
                  onTabChange?.(value);
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "general" && (
        <>
          <Quality
            data={settings.trackQuality}
            vip={user?.isVIP() ?? false}
            updateQuality={updateQuality}
          />
          <Device output={output} updateOutput={updateOutput} />
          <Capsule data={settings.preference} patchSettings={patchSettings} />
          <Performance data={settings.performance} patchSettings={patchSettings} />
          <Preference data={settings.preference} patchSettings={patchSettings} />
          <Shortcut data={settings.shortcuts} patchSettings={patchSettings} />
          <Cache
            refreshSize={refreshSize}
            cacheStoreSizes={cacheStoreSizes}
            cacheStoreConfig={cacheStoreConfig}
            updateCacheStoreConfig={updateCacheStoreConfig}
          />
        </>
      )}
      <AgentSettings active={activeTab === "agent"} />
    </main>
  );
};

export default memo(SettingsContent);
