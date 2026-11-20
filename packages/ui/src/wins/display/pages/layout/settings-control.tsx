import { Settings } from "lucide-react";
import { memo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { DisplaySettingsContent } from "@/wins/display/pages/settings";
import IconButton from "@/common/components/data-input/icon-button";
import AppDrawer, { createSettingsDrawer } from "@/common/components/display/drawer";
import type { SettingsTab } from "@/common/components/page/settings";

const SettingsControl = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { create } = AppDrawer.useDrawer();
  const open = useCallback(() => {
    let selectedTab: SettingsTab = "general";
    create(createSettingsDrawer, {
      content: (
        <DisplaySettingsContent
          routerActive={false}
          onTabChange={(tab) => {
            selectedTab = tab;
          }}
          inDrawer
        />
      ),
      onPageAction: () =>
        navigate(
          selectedTab === "agent"
            ? RoutePath.withQuery(RoutePathDisplay.settings, { tab: selectedTab })
            : RoutePathDisplay.settings
        )
    });
  }, [create, navigate]);

  if (location.pathname === RoutePathDisplay.settings) return null;
  return <IconButton label="设置" size="compact" icon={Settings} variant="plain" onClick={open} />;
};

export default memo(SettingsControl);
