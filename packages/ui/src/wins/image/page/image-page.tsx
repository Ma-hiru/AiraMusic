import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useState } from "react";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { RendererWindow } from "@/common/lib/window";
import Drag from "@/common/components/drag/drag";
import ImageViewer, { type ImageViewerEntry } from "@/common/components/image/image-viewer";
import TopControlPure from "@/common/components/top/control";
import AppToast from "@/common/components/toast";

type ImageGalleryState = {
  images: ImageViewerEntry[];
  index: number;
};

const ImagePage: FC = () => {
  const [{ images, index }, setGallery] = useState<ImageGalleryState>({
    images: [],
    index: 0
  });
  const [showToolBar, setShowToolBar] = useState(false);

  useEffect(() => {
    return RendererWindow.all.listenMessageAll("imageCheckerBus", (props) => {
      const { url, alt } = props.data;
      if (!url) return;

      setGallery((prev) => {
        const existed = prev.images.findIndex((image) => image.url === url);
        if (existed !== -1) {
          const nextImages = [...prev.images];
          nextImages[existed] = { ...nextImages[existed], alt };
          return { images: nextImages, index: existed };
        }

        return {
          images: [...prev.images, { url, alt }],
          index: prev.images.length
        };
      });
    });
  }, []);

  useAppLoaded();

  const handleIndexChange = useCallback((nextIndex: number) => {
    setGallery((prev) => {
      const maxIndex = Math.max(prev.images.length - 1, 0);
      return {
        ...prev,
        index: Math.min(Math.max(nextIndex, 0), maxIndex)
      };
    });
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <ImageViewer
        images={images}
        index={index}
        onIndexChange={handleIndexChange}
        onToolBarChange={setShowToolBar}
      />
      <Drag
        className={cx(
          `
            absolute left-0 right-0 top-0 z-50 flex h-12 items-center justify-end px-4
            transition-all duration-300 ease-in-out
          `,
          showToolBar ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        )}>
        <TopControlPure
          color="#ffffff"
          className="
            rounded-md border border-white/10 bg-black/35 px-3 py-1.5
            shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md
          "
        />
      </Drag>
      <AppToast.Provider className="top-12 z-[70]" />
    </div>
  );
};

export default memo(ImagePage);
