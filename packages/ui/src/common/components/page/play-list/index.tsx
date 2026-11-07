import { memo } from "react";
import { cx } from "@emotion/css";

import PlayListStats from "./stats";
import PlayListQueue, { type PlayListQueueProps } from "./queue";

export { type PlayListQueueProps, default as PlayListQueue } from "./queue";

export type PlayListProps = PlayListQueueProps & {
  className?: string;
  statsRevision?: number;
};

const PlayList = ({ className, active = true, statsRevision, ...queueProps }: PlayListProps) => (
  <section className={cx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
    <header className="mb-4 shrink-0">
      <h1 className="text-xl font-semibold tracking-tight">
        播放列表
        <span className="ml-1 opacity-80">({queueProps.tracks.length})</span>
      </h1>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_216px] lg:grid-rows-1">
      <div className="min-h-0 min-w-0 lg:col-start-1 lg:row-start-1">
        <PlayListQueue {...queueProps} active={active} />
      </div>
      <PlayListStats
        className="row-start-1 border-b border-white/10 pb-4 lg:col-start-2 lg:border-b-0 lg:border-l lg:pb-0 lg:pl-4"
        active={active}
        statsRevision={statsRevision}
      />
    </div>
  </section>
);

export default memo(PlayList);
