import { type FC, memo, useMemo } from "react";
import { useUserStore } from "@mahiru/ui/common/store/user";
import { NeteaseSettings, NeteaseUser } from "@mahiru/ui/common/source/netease/models";

import Settings from "@mahiru/ui/common/components/page/settings";
import { NeteaseServicesAuth } from "@mahiru/ui/common/source/netease/services";

const SettingsDisplay: FC<object> = () => {
  const { _user, _settings, updateSettings } = useUserStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);
  const settings = useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);

  return (
    <Settings
      className="display-container"
      user={user}
      settings={settings}
      updateSettings={updateSettings}
      login={NeteaseServicesAuth.createLoginWindow}
      logout={NeteaseServicesAuth.logout}
    />
  );
};

export default memo(SettingsDisplay);
