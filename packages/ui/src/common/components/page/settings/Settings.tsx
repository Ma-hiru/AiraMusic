import { type FC, memo } from "react";
import { useSettings } from "@mahiru/ui/common/store/user";

const Settings: FC<object> = () => {
  useSettings();
  return <></>;
};

export default memo(Settings);
