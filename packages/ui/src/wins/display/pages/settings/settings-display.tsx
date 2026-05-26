import { type FC, memo } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { settingsStoreSnapshot, useSettings } from "@/common/store/settings";

import Settings from "@/common/components/page/settings";

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
