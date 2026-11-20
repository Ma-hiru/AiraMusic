import { memo, type FC, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RendererOutput } from "@/common/lib/output";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useSettings, settingsStoreSnapshot } from "@/common/store/settings";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import Settings, { type SettingsTab } from "@/common/components/page/settings";

interface DisplaySettingsContentProps {
  tab?: SettingsTab;
  className?: string;
  inDrawer?: boolean;
  routerActive: boolean;
  onTabChange?: NormalFunc<[tab: SettingsTab]>;
}

const SettingsDisplay: FC<object> = () => {
  useDisplayTitleRegister("settings", "设置");
  const routerActive = useRouterActive(RoutePathDisplay, "settings");
  const navigate = useNavigate();
  const location = useLocation();
  const { tab } = RoutePath.parseQuery<{ tab?: string }>(location, RoutePathDisplay.settings);
  const changeTab = useCallback(
    (next: SettingsTab) =>
      navigate(
        next === "agent"
          ? RoutePath.withQuery(RoutePathDisplay.settings, { tab: next })
          : RoutePathDisplay.settings,
        { replace: true }
      ),
    [navigate]
  );

  return (
    <DisplaySettingsContent
      className="display-container"
      routerActive={routerActive}
      tab={tab === "agent" ? "agent" : "general"}
      onTabChange={changeTab}
    />
  );
};

export const DisplaySettingsContent: FC<DisplaySettingsContentProps> = ({
  className,
  onTabChange,
  tab,
  inDrawer,
  routerActive
}) => {
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
      className={className}
      tab={tab}
      login={login}
      output={output}
      user={useUser()}
      inDrawer={inDrawer}
      settings={useSettings()}
      routerActive={routerActive}
      updateOutput={updateOutput}
      logout={NeteaseServicesAuth.logout}
      updateSettings={settingsStoreSnapshot().updateSettings}
      onTabChange={onTabChange}
    />
  );
};

export default memo(SettingsDisplay);
