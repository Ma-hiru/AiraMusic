import { memo } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayListeningFootprint } from "@/wins/display/hooks/use-display-listening-footprint";
import ListeningFootprint from "@/common/components/page/listening-footprint";
import type { ListeningPeriod } from "@/common/hooks/use-listening-footprint";

const ListeningFootprintDisplay = () => {
  const location = useLocation();
  const query = RoutePath.parseQuery<{ day?: string; period: ListeningPeriod }>(
    location,
    RoutePathDisplay.listeningFootprint
  );
  const period = query.period === "week" || query.period === "month" ? query.period : "today";
  const day = period !== "today" && query.day ? query.day : undefined;
  const active = useRouterActive(RoutePathDisplay, "listeningFootprint");
  const props = useDisplayListeningFootprint(active);
  useDisplayTitleRegister("listeningFootprint", "听歌足迹");

  return (
    <main className="display-container min-h-0">
      <ListeningFootprint
        key={`${period}:${day ?? ""}`}
        {...props}
        variant="page"
        initialDay={day}
        initialPeriod={period}
      />
    </main>
  );
};

export default memo(ListeningFootprintDisplay);
