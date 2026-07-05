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
      <div className="flex justify-end gap-2">
        <div className="grid max-w-[78%] justify-items-end gap-1">
          <div className="max-w-full truncate pr-1 text-[11px] font-semibold text-white/42">
            {displayName}
          </div>
          <article
            className="
              rounded-lg border border-primary/35 bg-primary/85 px-3 py-2
              text-[13px] leading-5 text-primary-text shadow-sm
            ">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </article>
        </div>
        <div className="mt-5 flex size-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/12 text-white/70">
          {userAvatar ? (
            <NeteaseImage
              className="size-full rounded-md"
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
    <div className="flex justify-start">
      <article
        className={cx(
          `
            min-w-0 max-w-[82%] rounded-lg border border-white/10 bg-white/10
            px-3 py-2 shadow-sm
          `,
          streaming && "border-white/15 bg-white/12"
        )}>
        <MarkdownContent streaming={streaming} content={message.content ?? ""} />
      </article>
    </div>
  );
};

export default memo(ContentItem);
