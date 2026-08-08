import { cx } from "@emotion/css";
import { memo, useRef, type FC, useState, useEffect } from "react";
import { RendererWindow } from "@/common/lib/window";
import RadioMeta from "@/wins/radio/page/radio-meta";
import RadioLyric from "@/wins/radio/page/radio-lyric";
import RadioComment from "@/wins/radio/page/radio-comment";

interface RadioContentProps {
  openComment?: boolean;
}

const RadioContent: FC<RadioContentProps> = ({ openComment = true }) => {
  const [showCommentPanel, setShowCommentPanel] = useState(openComment);
  const commentRef = useRef<HTMLDivElement>(null);

  const memoPanelSize = useRef<Nullable<{ width: number; height: number }>>(null);
  useEffect(() => {
    if (openComment) {
      const panelWidth = memoPanelSize.current;
      panelWidth &&
        RendererWindow.current.resize({ width: panelWidth.width, height: panelWidth.height });
      memoPanelSize.current = null;
    } else if (!memoPanelSize.current) {
      const commentPanelW = commentRef.current?.getBoundingClientRect().width;
      memoPanelSize.current = {
        height: window.innerHeight,
        width: window.innerWidth
      };
      commentPanelW &&
        RendererWindow.current.resize({
          deltaWidth: -commentPanelW * 0.9,
          deltaHeight: -window.innerHeight * 0.1
        });
    }
    setShowCommentPanel(openComment);
  }, [openComment]);

  return (
    <main className="flex h-full w-full contain-strict">
      <RadioMeta className={cx("h-full shrink-0 w-[30%]!", !openComment && "w-[45%]!")} />
      <RadioLyric
        className={cx(
          "h-[95%] my-auto shrink-0 w-[38%]! mr-[2%]",
          !openComment && "mr-0! w-[55%]!"
        )}
      />
      {showCommentPanel && <span className="h-[80%] w-px border my-auto opacity-10" />}
      <RadioComment
        ref={commentRef}
        className={cx(
          "h-[95%] my-auto shrink-0 w-[30%]!",
          !openComment && "absolute -right-[30%] invisible"
        )}
      />
    </main>
  );
};

export default memo(RadioContent);
