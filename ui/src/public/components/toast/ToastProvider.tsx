import { FC, memo } from "react";

const ToastProvider: FC<object> = () => {
  return <div className="fixed z-25"></div>;
};
export default memo(ToastProvider);
