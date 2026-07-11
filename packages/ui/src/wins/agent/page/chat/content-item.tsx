import { cx } from "@emotion/css";
import { Copy, Check, UserRound } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import AppToast from "@/common/components/display/toast";
import NeteaseImage from "@/common/components/display/image/netease-image";
import type { LLMMessage } from "@mahiru/ai";
import type { NeteaseNetworkImage } from "@/common/netease/models";

import MarkdownContent from "./markdown-content";

interface ContentItemProps {
  userName?: string;
  message: LLMMessage;
  streaming?: boolean;
  userAvatar?: Nullable<NeteaseNetworkImage>;
}

const ContentItem: FC<ContentItemProps> = ({ message, userName, streaming, userAvatar }) => {
  const isUser = message.role === "user";
  const copiedTimerRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const content = message.content ?? "";
  const copyContent = useCallback(async () => {
    if (!content) return;
    try {
      await window.navigator.clipboard.writeText(content);
      setCopied(true);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
      AppToast.show({ type: "success", text: "回复已复制" });
    } catch {
      AppToast.show({ type: "error", text: "复制失败" });
    }
  }, [content]);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  if (message.role === "tool") return null;

  if (isUser) {
    const displayName = userName || "你";

    return (
      <div className="flex min-w-0 justify-end">
        <article className="grid min-w-0 max-w-[min(100%,48rem)] justify-items-end gap-1.5 px-1 py-1">
          <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-[11px] font-semibold text-white/48">
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-white/10 text-white/64">
              {userAvatar ? (
                <NeteaseImage
                  className="size-full rounded-lg"
                  cache={true}
                  shadow="none"
                  preview={false}
                  cacheLazy={false}
                  image={userAvatar}
                  title={displayName}
                />
              ) : (
                <UserRound className="size-3.5" />
              )}
            </span>
            <span className="min-w-0 truncate">{displayName}</span>
          </div>
          <div
            className="
              max-w-full whitespace-pre-wrap break-words rounded-2xl bg-white/10
              px-3.5 py-2.5 text-left text-[14px] leading-6 text-white/88
            ">
            {message.content}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 justify-start">
      <article
        className={cx(
          `
            group relative min-w-0 max-w-[min(100%,48rem)] rounded-2xl
            px-2 py-1.5 pr-9 transition-colors duration-200 hover:bg-white/[0.035]
          `,
          streaming && "bg-white/4.5"
        )}>
        <MarkdownContent content={content} streaming={streaming} />
        <button
          className="
            absolute top-1 right-1 inline-flex size-7 cursor-pointer items-center
            justify-center rounded-lg border border-white/10 bg-black/18 text-white/50
            opacity-0 outline-none transition-all duration-200 hover:bg-white/10
            hover:text-white focus-visible:opacity-100 focus-visible:ring-2
            focus-visible:ring-white/45 group-hover:opacity-100
            disabled:pointer-events-none disabled:opacity-0
          "
          title="复制回复"
          type="button"
          aria-label="复制回复"
          disabled={!content}
          onClick={copyContent}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </article>
    </div>
  );
};

export default memo(ContentItem);
