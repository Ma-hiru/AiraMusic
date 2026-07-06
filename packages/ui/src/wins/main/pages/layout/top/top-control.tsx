import { Bot, PictureInPicture } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import { RendererCache } from "@/common/lib/cache";
import { RendererWindow } from "@/common/lib/window";
import { useListenable } from "@/common/hooks/use-listenable";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import Switch from "@/common/components/data-input/switch";
import Control from "@/common/components/layout/top/control";
import AppModal, { createDialogModal } from "@/common/components/display/modal";

const TopControl: FC = () => {
  const { create } = AppModal.useModal();
  const currentWindow = useListenable(RendererWindow.current);
  const miniWindow = useListenable(RendererWindow.get("miniplayer"));
  const memoRef = useRef(false);

  const close = useCallback(async () => {
    type Behavior = "exit" | "tray";

    const behavior = RendererCache.browser.getOne<Behavior>("main-exit-behavior");
    const exit = () => {
      RendererWindow.current.hide();
      RendererWindow.all.hide();
      RendererPlayerHandle[Symbol.dispose]();
      RendererWindow.current.close();
    };
    const hidden = () => RendererWindow.current.hide();

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
  }, [create]);

  const mini = useCallback(() => {
    RendererWindow.mini.show();
    RendererWindow.mini.focus();
    RendererWindow.current.hide();
  }, []);

  useEffect(() => {
    const sub1 = miniWindow.addEventListener("show", () => currentWindow.hide());
    const sub2 = currentWindow.addEventListener("show", () => miniWindow.hide());
    return () => {
      sub1();
      sub2();
    };
  }, [currentWindow, miniWindow]);

  return (
    <Control
      onClose={close}
      appends={[
        {
          icon: PictureInPicture,
          label: "打开迷你播放器",
          onClick: mini
        },
        {
          icon: Bot,
          label: "Agent",
          onClick: () => {
            if (RendererWindow.agent.opened) {
              RendererWindow.agent.show();
              RendererWindow.agent.focus();
            } else {
              void RendererWindow.agent.reactReadyAwait();
            }
          }
        }
      ]}
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
