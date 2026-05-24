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
    <section
      className={cx(
        `
          h-full overflow-y-auto lg:overflow-hidden scrollbar scrollbar-show
          lg:scrollbar-hidden text-(--text-color-on-main)
          grid grid-cols-1 lg:grid-cols-[minmax(260px,0.82fr)_minmax(520px,1.58fr)] gap-4
        `,
        className
      )}>
      <SettingsAside user={user} settings={settings} logout={logout} login={login} />
      <SettingsContent user={user} settings={settings} updateSettings={updateSettings} />
    </section>
  );
};

export default memo(Settings);
