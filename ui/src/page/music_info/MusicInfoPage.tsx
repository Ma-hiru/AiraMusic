import { FC, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfoCtx } from "@mahiru/ui/ctx/InfoCtx";

const MusicInfoPage: FC<object> = () => {
  const [URLSearchParams] = useSearchParams();
  const { mainColor } = useInfoCtx();
  return <div style={{ color: mainColor }}>{URLSearchParams.get("id")}</div>;
};
export default memo(MusicInfoPage);
