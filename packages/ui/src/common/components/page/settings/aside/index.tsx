import { type FC, memo } from "react";
import { NeteaseSettings, NeteaseUser } from "@/common/source/netease/models";

import UserDetail from "./user-detail";
import SettingsSummary from "./settings-summary";

interface SettingsAsideProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettings;
  login: NormalFunc;
  logout: NormalFunc;
}

const SettingsAside: FC<SettingsAsideProps> = ({ settings, user, logout, login }) => {
  return (
    <aside className="flex flex-col gap-4">
      <UserDetail user={user} login={login} logout={logout} />
      <SettingsSummary settings={settings} />
    </aside>
  );
};

export default memo(SettingsAside);
