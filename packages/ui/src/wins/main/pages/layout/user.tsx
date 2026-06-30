import { useEffect } from "react";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { Log } from "@/common/lib/log";
import { SetupStatus } from "@/common/netease/services/auth";
import { RendererWindow } from "@/common/lib/window";
import AppToast from "@/common/components/display/toast";

export const User = () => {
  const { data, fetchData } = useRequestStatusWrap(
    NeteaseServicesAuth.setup.bind(NeteaseServicesAuth)
  );
  const { reload } = useRequestAutoRetry(
    fetchData,
    [],
    () => data !== undefined && data !== SetupStatus.NetErr && data !== SetupStatus.Unknown
  );

  useEffect(() => {
    if (data === SetupStatus.Expired) {
      AppToast.show({
        type: "error",
        text: "登录过期"
      });
      void NeteaseServicesAuth.createLoginWindow();
    } else if (data === SetupStatus.Unknown) {
      AppToast.show({
        type: "error",
        text: "未知错误"
      });
    } else if (data === SetupStatus.NetErr) {
      AppToast.show({
        type: "error",
        text: "网络错误，请检查网络"
      });
    } else if (data === SetupStatus.NotLogin) {
      void NeteaseServicesAuth.createLoginWindow();
    } else if (data === SetupStatus.Ok) {
      Log.info("User", "user info get success");
    }
  }, [data]);

  useEffect(() => {
    return RendererWindow.all.listenMessageAll("message_dispatch_need_login", () => {
      if (NeteaseServicesAuth.isLoggedIn) {
        return reload();
      }
      return NeteaseServicesAuth.createLoginWindow();
    });
  }, [reload]);

  return null;
};

export default User;
