import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { NeteaseSettings, NeteaseUser } from "@/common/netease/models";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";

import UserDetail from "./user-detail";
import SettingsSummary from "./settings-summary";

interface SettingsAsideProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettings;
  login: NormalFunc;
  logout: NormalFunc;
  cacheStoreConfig: Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>;
  className?: string;
}

const SettingsAside: FC<SettingsAsideProps> = ({
  settings,
  user,
  logout,
  login,
  cacheStoreConfig,
  className
}) => {
  return (
    <aside className={cx("w-full flex flex-col gap-4", className)}>
      <UserDetail user={user} login={login} logout={logout} />
      <SettingsSummary settings={settings} cacheStoreConfig={cacheStoreConfig} />
    </aside>
  );
};

export default memo(SettingsAside);
