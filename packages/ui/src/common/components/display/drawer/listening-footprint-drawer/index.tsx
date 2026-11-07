import { RotateCwSquare, SquareArrowOutUpRight } from "lucide-react";
import { useState, createRef, useEffect, useCallback, type ReactNode, type RefObject } from "react";
import { useListenable } from "@/common/hooks/use-listenable";
import IconButton from "@/common/components/data-input/icon-button";
import ListeningFootprint, {
  type ListeningFootprintProps,
  type ListeningFootprintScope,
  type ListeningFootprintActions
} from "@/common/components/page/listening-footprint";
import type RendererPlayer from "@/common/player/core";

import AppDrawer from "../use";
import type { DrawerRender } from "../drawer-provider";

export type ListeningFootprintDrawerProps = {
  content: ReactNode;
  toggleKey?: string;
  onPageAction?: NormalFunc;
  actionsRef?: RefObject<Nullable<ListeningFootprintActions>>;
};

export type PlayerListeningFootprintDrawerProps = {
  player: RendererPlayer;
  onPageAction?: NormalFunc<[scope: ListeningFootprintScope]>;
} & Omit<
  ListeningFootprintProps,
  | "active"
  | "variant"
  | "actionsRef"
  | "activeTrackID"
  | "onScopeChange"
  | "historyRecords"
  | "historyRevision"
>;

let contentKey = 0;

export function createListeningFootprintDrawer({
  onPageAction,
  content,
  actionsRef,
  toggleKey = "listening-footprint:today:"
}: ListeningFootprintDrawerProps): DrawerRender {
  return {
    toggleKey,
    title: "听歌足迹",
    width: 480,
    resizable: { minWidth: 420, maxWidth: 640 },
    contentClassName: "overflow-hidden!",
    headerActions: (
      <>
        {actionsRef && (
          <IconButton
            label="刷新听歌足迹"
            variant="plain"
            icon={RotateCwSquare}
            iconClassName="size-5!"
            onClick={() => actionsRef.current?.refresh()}
          />
        )}
        {onPageAction && (
          <IconButton
            label="展开听歌足迹"
            variant="plain"
            iconClassName="size-4!"
            icon={SquareArrowOutUpRight}
            onClick={() => {
              AppDrawer.close();
              onPageAction();
            }}
          />
        )}
      </>
    ),
    content
  };
}

export function createPlayerListeningFootprintDrawer({
  onPageAction,
  ...props
}: PlayerListeningFootprintDrawerProps): DrawerRender {
  const actionsRef = createRef<ListeningFootprintActions>();
  const scopeRef: { current: ListeningFootprintScope } = {
    current: {
      period: props.initialPeriod ?? "today",
      ...(props.initialDay ? { day: props.initialDay } : {})
    }
  };
  return createListeningFootprintDrawer({
    toggleKey: `listening-footprint:${props.initialPeriod ?? "today"}:${props.initialDay ?? ""}`,
    actionsRef,
    content: (
      <PlayerListeningFootprintContent
        key={++contentKey}
        {...props}
        actionsRef={actionsRef}
        onScopeChange={(scope) => {
          scopeRef.current = scope;
        }}
      />
    ),
    onPageAction: onPageAction ? () => onPageAction(scopeRef.current) : undefined
  });
}

// eslint-disable-next-line react-refresh/only-export-components
const PlayerListeningFootprintContent = ({
  onClickAlbum,
  onClickArtist,
  player: rendererPlayer,
  ...props
}: Omit<PlayerListeningFootprintDrawerProps, "onPageAction"> &
  Pick<ListeningFootprintProps, "actionsRef" | "onScopeChange">) => {
  const player = useListenable(rendererPlayer);
  const [history, setHistory] = useState(() => ({
    records: [...player.history.list],
    revision: 0
  }));
  useEffect(
    () =>
      player.history.addListener(() => {
        setHistory((previous) => ({
          records: [...player.history.list],
          revision: previous.revision + 1
        }));
      }),
    [player.history]
  );
  const jumpAlbum = useCallback(
    (id: number) => {
      void onClickAlbum(id);
      AppDrawer.close();
    },
    [onClickAlbum]
  );
  const jumpArtist = useCallback(
    (id: number) => {
      void onClickArtist(id);
      AppDrawer.close();
    },
    [onClickArtist]
  );

  return (
    <ListeningFootprint
      {...props}
      variant="drawer"
      historyRecords={history.records}
      historyRevision={history.revision}
      activeTrackID={player.current.track?.id}
      onClickAlbum={jumpAlbum}
      onClickArtist={jumpArtist}
    />
  );
};
