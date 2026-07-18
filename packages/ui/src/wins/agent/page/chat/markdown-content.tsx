import "streamdown/styles.css";

import { cx } from "@emotion/css";
import { memo, type FC, useMemo, type ComponentProps } from "react";
import { Streamdown, type Components, defaultRemarkPlugins } from "streamdown";
import { parseAiraResourceURI, parseAiraRichContent, resolveAiraResourceAction } from "@mahiru/ai";

import AgentResourceCard from "./resource-card";
import { remarkAiraResourceLinks } from "./rich-markdown";
import { runAiraResourceAction } from "./resource-actions";

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

const AiraMarkdownLink: FC<{ node?: unknown } & ComponentProps<"a">> = ({ node, ...props }) => {
  void node;
  return <a {...props} target="_blank" rel="noreferrer" />;
};

const AiraResourceLink: FC<
  ComponentProps<"span"> & {
    kind?: string;
    node?: unknown;
    disabled?: boolean;
    resourceid?: string;
  }
> = ({ kind, node, children, disabled, resourceid: id, ...props }) => {
  void node;
  const resource = parseAiraResourceURI(`aira://${kind}/${id}`);
  if (!resource) return <span {...props}>{children}</span>;

  const action = resolveAiraResourceAction(resource);
  return (
    <button
      type="button"
      disabled={disabled}
      data-aira-resource-link={resource.kind}
      title={action === "play" ? "在 AiraMusic 中播放" : "在 AiraMusic 中查看"}
      onClick={(event) => {
        event.preventDefault();
        if (disabled) return;
        void runAiraResourceAction(resource, action).catch(() => undefined);
      }}>
      {children}
    </button>
  );
};

/**
 * Streamdown 的 remarkPlugins 是整表替换，不是追加。
 * 必须显式带上 defaultRemarkPlugins（含 remark-gfm），否则表格 / 任务列表 / 删除线等 GFM 全部失效。
 */
const markdownRemarkPlugins = [...Object.values(defaultRemarkPlugins), remarkAiraResourceLinks];

const MarkdownContent: FC<MarkdownContentProps> = ({ className, content, streaming }) => {
  const document = useMemo(
    () => parseAiraRichContent(content, { streaming: !!streaming }),
    [content, streaming]
  );
  const markdownComponents = useMemo<Components>(
    () => ({
      a: AiraMarkdownLink,
      "aira-resource": (props) => <AiraResourceLink {...props} disabled={!!streaming} />
    }),
    [streaming]
  );

  if (!content && streaming) {
    return (
      <span className={cx("agent-markdown inline-flex items-center", className)}>
        正在思考
        <span className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-white/60" />
      </span>
    );
  }

  return (
    <div className={cx("agent-rich-content", className)}>
      {document.segments.map((segment, index) =>
        segment.type === "card" ? (
          streaming ? (
            <ResourceCardSkeleton key={`card-pending-${index}`} />
          ) : (
            <AgentResourceCard
              key={`card-${index}-${segment.card.kind}-${segment.card.id}`}
              card={segment.card}
            />
          )
        ) : (
          <Streamdown
            key={`markdown-${index}`}
            className="agent-markdown text-[13px] leading-[1.78] font-normal text-white/82"
            controls={false}
            lineNumbers={false}
            isAnimating={!!streaming}
            components={markdownComponents}
            literalTagContent={["aira-resource"]}
            remarkPlugins={markdownRemarkPlugins}
            mode={streaming ? "streaming" : "static"}
            animated={streaming ? streamAnimation : false}
            allowedTags={{ "aira-resource": ["kind", "resourceid"] }}>
            {segment.content}
          </Streamdown>
        )
      )}
      {document.pendingCard && <ResourceCardSkeleton />}
    </div>
  );
};

const ResourceCardSkeleton = () => (
  <article
    className="agent-resource-card agent-resource-card-loading"
    role="status"
    aria-busy="true"
    aria-label="正在生成音乐资源卡片">
    <span className="agent-resource-cover-skeleton" />
    <span className="agent-resource-loading-lines">
      <i />
      <i />
      <i />
    </span>
  </article>
);

export default memo(MarkdownContent);
