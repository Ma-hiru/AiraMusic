import { FC, memo } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath } from "@mahiru/ui/public/routes";

const ArtistPage: FC<object> = () => {
  const location = useLocation();
  const { id } = RoutePath.parseQuery<{ id: number }>(location);
  return <div className="router-container"></div>;
};

export default memo(ArtistPage);
