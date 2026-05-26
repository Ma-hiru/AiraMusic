import { type FC, useEffect } from "react";
import { NeteaseServicesAuth } from "@/common/source/netease/services";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppToast from "@/common/components/toast";
import { Log } from "@/common/lib/log";

export const User: FC = () => {
  const { status, data, fetchData } = useRequestStatusWrap(
    NeteaseServicesAuth.setup.bind(NeteaseServicesAuth)
  );
  useRequestAutoRetry(fetchData, [], () => data === true);
  useEffect(() => {
    data === false && NeteaseServicesAuth.createLoginWindow();
  }, [data]);
  useEffect(() => {
    if (status === "error") {
      AppToast.show({
        type: "error",
        text: "获取用户信息失败，请检查稍后再试或重新登录"
      });
    } else if (status === "success") {
      Log.info("User", "user info get success");
    }
  }, [status]);

  return null;
};

export default User;
