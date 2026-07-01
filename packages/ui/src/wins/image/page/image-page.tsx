import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useState } from "react";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AppToast from "@/common/components/display/toast";

import Drag from "@/common/components/layout/drag/drag";
import ImageViewer from "@/common/components/display/image/image-viewer";
import Control from "@/common/components/layout/top/control";

type ImageGalleryState = {
  images: { url?: string; alt?: string }[];
  index: number;
};

const ImagePage: FC = () => {
  const [{ images, index }, setGallery] = useState<ImageGalleryState>({
    images: [],
    index: 0
  });
  const [showToolBar, setShowToolBar] = useState(false);
  const previewBus = useListenable(RendererIPCMessageBus.preview);

  useEffect(() => {
    const previews = previewBus.data;
    for (const { url, alt } of previews) {
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
    }
    RendererIPCMessageBus.consume(previewBus.type);
  }, [previewBus.data, previewBus.type]);

  useAppLoaded();
  useThemeInjectFromBus();

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
        <Control
          color="#ffffff"
          className="
            rounded-md border border-white/10 bg-black/35 px-3 py-1.5
            shadow-[0_8px_32px_rgba(0,0,0,0.25)]
            backdrop-saturate-120 backdrop-blur-md
          "
          mini
          pin
        />
      </Drag>
      <AppToast.Provider className="top-12 z-70" itemContainerClassName="bg-black/35!" />
    </div>
  );
};

export default memo(ImagePage);
