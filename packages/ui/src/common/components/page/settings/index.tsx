import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import {
  NeteaseSettings,
  type NeteaseSettingsModel,
  NeteaseUser
} from "@mahiru/ui/common/source/netease/models";

import SettingsAside from "./aside";
import SettingsContent from "./content";

interface SettingsProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettings;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
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
  login
}) => {
  return (
    <div
      className={cx(
        "h-full min-h-0 overflow-y-auto scrollbar-hide text-(--text-color-on-main)",
        className
      )}>
      <section
        className={cx(
          `
          min-h-full
          grid grid-cols-1 lg:grid-cols-[minmax(260px,0.82fr)_minmax(520px,1.58fr)]
          gap-4
        `
        )}>
        <SettingsAside user={user} settings={settings} logout={logout} login={login} />
        <SettingsContent user={user} settings={settings} updateSettings={updateSettings} />
      </section>
    </div>
  );
};

export default memo(Settings);
