import { cx } from "@emotion/css";
import { memo, useId, type FC, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

interface ThinkBlockProps {
  content: string;
  /** 流式且 think 未闭合时展开并显示跳动点 */
  closed: boolean;
  streaming?: boolean;
}

const ThinkBlock: FC<ThinkBlockProps> = ({ closed, content, streaming }) => {
  const contentID = useId().replaceAll(":", "");
  const thinking = streaming && !closed;
  const [open, setOpen] = useState(thinking);
  const expanded = thinking || open;

  return (
    <section className="agent-think" data-thinking={thinking || undefined}>
      <button
        className="agent-think-toggle"
        type="button"
        disabled={thinking}
        aria-expanded={expanded}
        aria-controls={`think-${contentID}`}
        onClick={() => setOpen((value) => !value)}>
        <Brain className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{thinking ? "正在思考" : "思考过程"}</span>
        {thinking ? (
          <span className="agent-typing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : expanded ? (
          <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <div
          id={`think-${contentID}`}
          className={cx("agent-think-body", thinking && "agent-think-body-live")}>
          {content}
        </div>
      )}
    </section>
  );
};

export default memo(ThinkBlock);
