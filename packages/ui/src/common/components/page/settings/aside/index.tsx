import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { NeteaseUser, NeteaseSettings } from "@/common/netease/models";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";

// import Github from "./github";
import Version from "./version";
import UserDetail from "./user-detail";
import SettingsSummary from "./settings-summary";

interface SettingsAsideProps {
  login: NormalFunc;
  className?: string;
  logout: NormalFunc;
  showDetails: boolean;
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
  showDetails,
  cacheStoreConfig
}) => {
  return (
    <aside className={cx("w-full flex scrollbar flex-col gap-4", className)}>
      <UserDetail user={user} login={login} logout={logout} />
      {showDetails && (
        <>
          <SettingsSummary settings={settings} cacheStoreConfig={cacheStoreConfig} />
          <Version showExportLogs />
        </>
      )}
    </aside>
  );
};

export default memo(SettingsAside);
