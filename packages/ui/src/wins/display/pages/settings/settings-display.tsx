import { type FC, memo, useCallback, useMemo } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { settingsStoreSnapshot, useSettings } from "@/common/store/settings";

import Settings from "@/common/components/page/settings";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RendererOutput } from "@/common/lib/output";
import { RendererWindow } from "@/common/lib/window";

const SettingsDisplay: FC<object> = () => {
  const outputBus = useListenable(RendererIPCMessageBus.output);

  const output = useMemo(() => {
    if (outputBus.data) return outputBus.data;
    return {
      selected: RendererOutput.DEFAULT_DEVICE_ID,
      views: [{ deviceId: RendererOutput.DEFAULT_DEVICE_ID, displayName: "系统默认" }]
    };
  }, [outputBus.data]);

  const updateOutput = useCallback((deviceId: string) => {
    RendererWindow.main.send("message_dispatch_device_output_set", deviceId);
  }, []);
  return (
    <Settings
      className="display-container"
      output={output}
      user={useUser()}
      settings={useSettings()}
      updateOutput={updateOutput}
      updateSettings={settingsStoreSnapshot().updateSettings}
      login={NeteaseServicesAuth.createLoginWindow}
      logout={NeteaseServicesAuth.logout}
    />
  );
};

export default memo(SettingsDisplay);
