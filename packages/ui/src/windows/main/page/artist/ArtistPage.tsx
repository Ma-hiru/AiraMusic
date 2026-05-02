import { FC, memo } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath } from "@mahiru/ui/public/routes";

const ArtistPage: FC<object> = () => {
  const { id } = RoutePath.parseQuery<{ id: number }>(useLocation());
  return <div className="router-container">{id}</div>;
};

export default memo(ArtistPage);
