import { cx } from "@emotion/css";
import { X, ChevronRight } from "lucide-react";
import { type FC, useMemo, useState, useEffect, useCallback } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseURL } from "@/common/netease/models";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import Drag from "@/common/components/layout/drag/drag";
import AppToast from "@/common/components/display/toast";
import RadioContent from "@/wins/radio/page/radio-content";
import NoDrag from "@/common/components/layout/drag/no-drag";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const RadioPage: FC = () => {
  const [openCommentPanel, setOpenCommentPanel] = useState(true);
  const themeBus = useThemeInjectFromBus();
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);

  const track = trackMetaBus.data?.track?.detail;
  const coverURL = useMemo(
    () => NeteaseURL.setImageSize(track?.al.picUrl, NeteaseImageSize.sm),
    [track?.al.picUrl]
  );

  const close = useCallback(() => {
    RendererWindow.current.hide();
    RendererWindow.main.show();
    RendererWindow.main.focus();
  }, []);

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta");
    RendererIPCMessageBus.updater.deliver("track-progress");
  }, []);

  return (
    <Drag className={cx("relative overflow-hidden", !coverURL && "text-black")}>
      <section className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          className="absolute inset-0"
          blur={10}
          opacity={1}
          saturate={2}
          src={coverURL}
          brightness={0.6}
          themeColors={themeBus.data?.theme.themeColors}
        />
      </section>
      <section className="h-screen w-screen p-2 overflow-hidden contain-strict">
        <RadioContent openComment={openCommentPanel} />
        <NoDrag className="absolute top-2 right-2">
          <button
            className="
                flex size-5 items-center justify-center rounded-full outline-none
                transition-all duration-200 ease-in-out
                hover:bg-primary-text/50 hover:text-primary
                active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/35
              "
            title="隐藏"
            onClick={close}>
            <X className="size-3.5" />
          </button>
        </NoDrag>
        <NoDrag className="absolute top-1/2 -right-2 transform -translate-x-1/2 -translate-y-1/2">
          <button
            className={cx(
              `
              flex size-5 items-center justify-center rounded-full outline-none
              transition-all duration-200 ease-in-out
              hover:bg-primary-text/50 hover:text-primary
              active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/35
            `,
              !openCommentPanel ? "rotate-180" : ""
            )}
            title="隐藏"
            onClick={() => setOpenCommentPanel(!openCommentPanel)}>
            <ChevronRight className="size-4" />
          </button>
        </NoDrag>
      </section>
      <AppToast.Provider className="z-30!" />
    </Drag>
  );
};

export default RadioPage;
