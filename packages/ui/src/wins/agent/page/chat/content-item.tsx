import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { UserRound } from "lucide-react";
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
  if (message.role === "tool") return null;

  if (isUser) {
    const displayName = userName || "你";

    return (
      <div className="flex min-w-0 justify-end gap-2">
        <div className="grid max-w-[min(78%,36rem)] min-w-0 justify-items-end gap-1">
          <div className="max-w-full truncate pr-1 text-[11px] font-semibold text-white/48">
            {displayName}
          </div>
          <article
            className="
              min-w-0 rounded-2xl border border-primary/38 bg-primary/86 px-3.5 py-2.5
              text-[13px] leading-5 text-primary-text shadow-lg shadow-black/10
            ">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </article>
        </div>
        <div className="mt-5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/12 text-white/70 shadow-sm">
          {userAvatar ? (
            <NeteaseImage
              className="size-full rounded-xl"
              cache={true}
              shadow="none"
              preview={false}
              cacheLazy={false}
              image={userAvatar}
              title={displayName}
            />
          ) : (
            <UserRound className="size-4" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 justify-start">
      <article
        className={cx(
          `
            min-w-0 max-w-[min(100%,48rem)] rounded-2xl border border-white/10
            bg-white/[0.075] px-4 py-3 shadow-lg shadow-black/10
          `,
          streaming && "border-white/16 bg-white/[0.095]"
        )}>
        <MarkdownContent streaming={streaming} content={message.content ?? ""} />
      </article>
    </div>
  );
};

export default memo(ContentItem);
