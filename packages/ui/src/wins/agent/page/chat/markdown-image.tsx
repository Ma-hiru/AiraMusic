import { cx } from "@emotion/css";
import { memo, useState, type ComponentProps } from "react";
import type { ExtraProps } from "streamdown";

const MarkdownImage = ({
  className,
  onLoad,
  onError,
  alt,
  src,
  node,
  ...props
}: ExtraProps & ComponentProps<"img">) => {
  void node;
  const [failedSource, setFailedSource] = useState<string>();
  if (!src) return null;
  const failed = failedSource === src;

  // Markdown 图片可以嵌在段落、强调和链接里，容器及遮罩都必须是行内元素。
  return (
    <span className="group relative my-4 inline-block" data-streamdown="image-wrapper">
      <img
        {...props}
        className={cx("max-w-full rounded-lg", failed && "hidden", className)}
        alt={alt}
        src={src}
        data-streamdown="image"
        onError={(event) => {
          setFailedSource(src);
          onError?.(event);
        }}
        onLoad={(event) => {
          setFailedSource(undefined);
          onLoad?.(event);
        }}
      />
      {failed && (
        <span className="text-muted-foreground text-xs italic" data-streamdown="image-fallback">
          图片加载失败{alt ? `：${alt}` : ""}
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 hidden rounded-lg bg-black/10 group-hover:block" />
    </span>
  );
};

export default memo(MarkdownImage);
