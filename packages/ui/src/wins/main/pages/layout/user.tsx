import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererWindow } from "@/common/lib/window";
import { SetupStatus } from "@/common/netease/services/auth";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useUser, userStoreSnapshot } from "@/common/store/user";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";

export const User = () => {
  const user = useUser();
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
      void NeteaseServicesAuth.logout();
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

  useEffect(() => {
    user && !user.isLoggedIn && userStoreSnapshot().updateUser(null);
  }, [user]);

  useEffect(() => {
    const logout = () => {
      RendererPlayerHandle.player.history.clear();
      return NeteaseServicesAuth.createLoginWindow();
    };

    NeteaseServicesAuth.on_logout = logout;
    const unlisten = RendererIPC.MessageChannel.listen(
      "message_deliver_logout",
      "all",
      (ok) => ok && logout()
    );

    return () => {
      unlisten();
      NeteaseServicesAuth.on_logout = null;
    };
  }, []);

  return null;
};

export default User;
