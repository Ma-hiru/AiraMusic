import { memo, type FC, useMemo, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RoutePathDisplay } from "@/common/routes";
import { RendererOutput } from "@/common/lib/output";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useSettings, settingsStoreSnapshot } from "@/common/store/settings";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import Settings from "@/common/components/page/settings";

const SettingsDisplay: FC<object> = () => {
  useDisplayTitleRegister("settings", "设置");
  const routerActive = useRouterActive(RoutePathDisplay, "settings");
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

  const login = useCallback(() => {
    RendererWindow.main.send("message_dispatch_need_login", true);
  }, []);

  return (
    <Settings
      className="display-container"
      login={login}
      output={output}
      user={useUser()}
      settings={useSettings()}
      routerActive={routerActive}
      updateOutput={updateOutput}
      logout={NeteaseServicesAuth.logout}
      updateSettings={settingsStoreSnapshot().updateSettings}
    />
  );
};

export default memo(SettingsDisplay);
