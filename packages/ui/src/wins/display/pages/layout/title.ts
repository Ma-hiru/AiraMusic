import { memo } from "react";
import { useDisplayTitle } from "@/wins/display/hooks/use-display-title";

const Title = () => {
  useDisplayTitle();
  return null;
};

export default memo(Title);
