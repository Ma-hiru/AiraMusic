import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { NeteaseUser, NeteaseSettings } from "@/common/netease/models";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";

import Github from "./github";
import Version from "./version";
import UserDetail from "./user-detail";
import SettingsSummary from "./settings-summary";

interface SettingsAsideProps {
  login: NormalFunc;
  className?: string;
  logout: NormalFunc;
  settings: NeteaseSettings;
  user: Nullable<NeteaseUser>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"invoke_cache_config_get">>;
}

const SettingsAside: FC<SettingsAsideProps> = ({
  user,
  className,
  login,
  logout,
  settings,
  cacheStoreConfig
}) => {
  return (
    <aside className={cx("w-full flex scrollbar flex-col gap-4", className)}>
      <UserDetail user={user} login={login} logout={logout} />
      <SettingsSummary settings={settings} cacheStoreConfig={cacheStoreConfig} />
      <Github />
      <Version />
    </aside>
  );
};

export default memo(SettingsAside);
