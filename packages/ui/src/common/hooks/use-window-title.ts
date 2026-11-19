import { useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";

export function useWindowTitle(
  title?:
    | string
    | NeteaseTrackModel
    | {
        name: string;
        ar: { name: string }[];
      }
) {
  const defaultTitle = RendererWindow.current.label;
  const updateTitle = useCallback(
    (
      title:
        | Optional<string>
        | NeteaseTrackModel
        | {
            name: string;
            ar: { name: string }[];
          }
    ) => {
      if (!title || title === defaultTitle) setTitle();
      else if (typeof title === "string") setTitle(`${defaultTitle} - ${title}`);
      else {
        setTitle(
          `${defaultTitle} - 《${title.name}》-${title.ar.map((artist) => artist.name).join("&")}`
        );
      }
    },
    [defaultTitle]
  );

  useEffect(() => {
    if (!title) return;
    updateTitle(title);
  }, [title, updateTitle]);

  return {
    updateTitle,
    defaultTitle
  };
}

const setTitle = (title?: string) => {
  title ||= RendererWindow.current.label;
  document.title = title;
  RendererWindow.current.title(title);
  Log.info("use-window-title", "set title", title);
};
