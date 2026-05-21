import { type FC, memo, useMemo } from "react";
import { useUserStore } from "@mahiru/ui/common/store/user";
import { NeteaseSettings, NeteaseUser } from "@mahiru/ui/common/source/netease/models";

import Settings from "@mahiru/ui/common/components/page/settings";

const SettingsDisplay: FC<object> = () => {
  const { _user, _settings, updateSettings, updateUser } = useUserStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);
  const settings = useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);

  return (
    <Settings
      user={user}
      settings={settings}
      updateSettings={updateSettings}
      updateUser={updateUser}
    />
  );
};

export default memo(SettingsDisplay);
