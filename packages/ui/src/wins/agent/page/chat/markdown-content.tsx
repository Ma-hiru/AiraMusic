import "streamdown/styles.css";

import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Streamdown } from "streamdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

const streamAnimation = {
  sep: "word",
  stagger: 8,
  duration: 120,
  animation: "fadeIn"
} as const;

const MarkdownContent: FC<MarkdownContentProps> = ({ className, content, streaming }) => {
  if (!content && streaming) {
    return (
      <span className={cx("agent-markdown inline-flex items-center", className)}>
        正在思考
        <span className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-white/60" />
      </span>
    );
  }

  return (
    <Streamdown
      className={cx("agent-markdown text-[14px] leading-6 text-white/88", className)}
      controls={false}
      lineNumbers={false}
      isAnimating={!!streaming}
      mode={streaming ? "streaming" : "static"}
      animated={streaming ? streamAnimation : false}>
      {content}
    </Streamdown>
  );
};

export default memo(MarkdownContent);
