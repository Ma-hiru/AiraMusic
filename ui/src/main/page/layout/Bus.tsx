import { FC, memo, useEffect } from "react";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

const Bus: FC<object> = () => {
  useEffect(() => {
    AppRenderer.Message.send("infoBus", "all", () => {});
  }, []);
  return <></>;
};
export default memo(Bus);
