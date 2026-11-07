import { ChartNoAxesColumn } from "lucide-react";
import { memo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useDisplayListeningFootprint } from "@/wins/display/hooks/use-display-listening-footprint";
import IconButton from "@/common/components/data-input/icon-button";
import ListeningFootprint from "@/common/components/page/listening-footprint";
import AppDrawer, { createListeningFootprintDrawer } from "@/common/components/display/drawer";
import type {
  ListeningFootprintProps,
  ListeningFootprintActions
} from "@/common/components/page/listening-footprint";

type OnScopeChange = NonNullable<ListeningFootprintProps["onScopeChange"]>;

const ListeningFootprintControl = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { create } = AppDrawer.useDrawer();
  const sessionRef = useRef(0);
  const actionsRef = useRef<ListeningFootprintActions>(null);
  const scopeRef = useRef<Parameters<OnScopeChange>[0]>({ period: "today" });
  const onScopeChange = useCallback<OnScopeChange>((scope) => {
    scopeRef.current = scope;
  }, []);
  const open = useCallback(() => {
    scopeRef.current = { period: "today" };
    create(createListeningFootprintDrawer, {
      actionsRef,
      content: (
        <DisplayListeningFootprintDrawerContent
          key={++sessionRef.current}
          actionsRef={actionsRef}
          onScopeChange={onScopeChange}
        />
      ),
      onPageAction: () =>
        navigate(RoutePath.withQuery(RoutePathDisplay.listeningFootprint, scopeRef.current))
    });
  }, [create, navigate, onScopeChange]);

  if (location.pathname === RoutePathDisplay.listeningFootprint) return null;
  return (
    <IconButton
      label="听歌足迹"
      size="compact"
      variant="plain"
      icon={ChartNoAxesColumn}
      onClick={open}
    />
  );
};

const DisplayListeningFootprintDrawerContent = ({
  onScopeChange,
  actionsRef
}: {
  onScopeChange: OnScopeChange;
} & Pick<ListeningFootprintProps, "actionsRef">) => {
  const props = useDisplayListeningFootprint(true, AppDrawer.close);
  return (
    <ListeningFootprint
      {...props}
      variant="drawer"
      actionsRef={actionsRef}
      onScopeChange={onScopeChange}
    />
  );
};

export default memo(ListeningFootprintControl);
