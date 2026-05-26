import { type FC, memo } from "react";
import { useUser } from "@mahiru/ui/common/store/user";
import { NeteaseServicesAuth } from "@mahiru/ui/common/source/netease/services";
import { settingsStoreSnapshot, useSettings } from "@mahiru/ui/common/store/settings";

import Settings from "@mahiru/ui/common/components/page/settings";

const SettingsDisplay: FC<object> = () => {
  return (
    <Settings
      className="display-container"
      user={useUser()}
      settings={useSettings()}
      updateSettings={settingsStoreSnapshot().updateSettings}
      login={NeteaseServicesAuth.createLoginWindow}
      logout={NeteaseServicesAuth.logout}
    />
  );
};

export default memo(SettingsDisplay);
