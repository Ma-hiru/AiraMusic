import { Bot, BoomBox, PictureInPicture } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererDevice } from "@/common/lib/device";
import { RendererWindow } from "@/common/lib/window";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import Switch from "@/common/components/data-input/switch";
import Control from "@/common/components/layout/top/control";
import AppModal, { createDialogModal } from "@/common/components/display/modal";

const TopControl: FC = () => {
  const { create } = AppModal.useModal();
  const memoRef = useRef(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [openingAgent, setOpeningAgent] = useState(false);

  const close = useCallback(
    async (quiting: boolean) => {
      const hidden = () => RendererWindow.current.hide();
      const exit = () => {
        RendererPlayerHandle[Symbol.dispose]();
        RendererWindow.current.hide();
        RendererWindow.all.hide();
        RendererWindow.current.close();
      };

      if (quiting) return exit();
      if ((await RendererDevice.platform) === "darwin") return hidden();

      const behavior = RendererCache.browser.getOne<Behavior>("main-exit-behavior");
      if (behavior === "exit") {
        exit();
      } else if (behavior === "tray") {
        hidden();
      } else if (behavior == null) {
        create(createDialogModal, {
          title: "退出",
          body: "是否最小化至系统托盘？",
          confirmText: "退出",
          cancelText: "最小化",
          important: true,
          footerExtraElement: (
            <AskMemo
              memo={memoRef.current}
              setMemo={(memo) => {
                memoRef.current = memo;
              }}
            />
          ),
          onConfirm: () => {
            memoRef.current && RendererCache.browser.setOne<Behavior>("main-exit-behavior", "exit");
            exit();
          },
          onConfirmCancel: () => {
            memoRef.current && RendererCache.browser.setOne<Behavior>("main-exit-behavior", "tray");
            hidden();
          }
        });
      }
    },
    [create]
  );

  const openMini = useCallback(() => {
    RendererWindow.current.hide();
    RendererWindow.mini
      .reactReadyAwait()
      .then(() => {
        RendererWindow.mini.show();
        RendererWindow.mini.focus();
      })
      .catch((err) => {
        Log.error("top-control", err);
        RendererWindow.current.show();
        RendererWindow.current.focus();
        AppToast.show({ type: "error", text: "窗口启动超时，请检查配置或重启应用" });
      });
  }, []);

  const openRadio = useCallback(() => {
    RendererWindow.current.hide();
    RendererWindow.radio
      .reactReadyAwait()
      .then(() => {
        RendererWindow.lyric.close();
        RendererWindow.radio.show();
        RendererWindow.radio.focus();
      })
      .catch((err) => {
        Log.error("top-control", err);
        RendererWindow.current.show();
        RendererWindow.current.focus();
        AppToast.show({ type: "error", text: "窗口启动超时，请检查配置或重启应用" });
      });
  }, []);

  const openAgent = useCallback(async () => {
    if (openingAgent) return;
    if (RendererWindow.agent.opened) {
      RendererWindow.agent.show();
      RendererWindow.agent.focus();
      return;
    }

    setOpeningAgent(true);
    try {
      await RendererWindow.agent.reactReadyAwait({ signal: AbortSignal.timeout(12_000) });
    } catch {
      AppToast.show({ type: "error", text: "Agent 窗口启动超时，请检查配置或重启应用" });
    } finally {
      setOpeningAgent(false);
    }
  }, [openingAgent]);

  useEffect(() => {
    const sub1 = RendererWindow.mini.addEventListener("show", () => RendererWindow.current.hide());
    const sub2 = RendererWindow.radio.addEventListener("show", () => RendererWindow.current.hide());
    const sub3 = RendererWindow.current.addEventListener("show", () => {
      RendererWindow.mini.hide();
      RendererWindow.radio.hide();
    });
    return () => {
      sub1();
      sub2();
      sub3();
    };
  }, []);

  useEffect(() => {
    void RendererIPC.NormalChannel.send("invoke_agent_feature_settings_get", undefined)
      .then((result) => result.ok && setAgentEnabled(result.data.effective.agentEnabled))
      .catch(() => setAgentEnabled(false));
    return RendererIPC.MessageChannel.listen(
      "message_deliver_agent_feature_settings",
      "process",
      (state) => setAgentEnabled(state.effective.agentEnabled)
    );
  }, []);

  return (
    <Control
      onClose={close}
      appends={[
        {
          icon: PictureInPicture,
          label: "打开迷你播放器",
          onClick: openMini
        },
        {
          icon: BoomBox,
          label: "音乐Radio",
          className: "scale-95",
          onClick: openRadio
        },
        {
          show: agentEnabled,
          icon: Bot,
          className: "scale-110",
          label: openingAgent ? "正在打开 Agent" : "Agent",
          onClick: openAgent
        }
      ]}
      max
      pin
      mini
    />
  );
};

export default memo(TopControl);

const AskMemo = ({ setMemo, memo }: { memo: boolean; setMemo: NormalFunc<[memo: boolean]> }) => {
  const [check, setCheck] = useState(memo);
  useEffect(() => setMemo(check), [check, setMemo]);
  return (
    <Switch
      className="hover:text-normal-text/50! focus-visible:ring-normal-text/40!"
      label="记住选择"
      checked={check}
      underlineClassName="bg-white!"
      onChange={setCheck}
    />
  );
};

type Behavior = "exit" | "tray";
