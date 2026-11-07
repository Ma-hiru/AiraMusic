import {
  Copy,
  Info,
  Play,
  Trash2,
  ListPlus,
  DiscAlbum,
  ListMusic,
  UserRound,
  FolderPlus,
  MessageSquare
} from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { userStoreSnapshot } from "@/common/store/user";
import { NeteaseUser, NeteaseTrackRecord, NeteaseNetworkImage } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import NeteaseImage from "@/common/components/display/image/netease-image";

import CommentCount from "./comment-count";
import type { ContextMenuItem, ContextMenuRender } from "./menu-provider";

export type TrackContextMenuAction =
  | "info"
  | "play"
  | "album"
  | "comment"
  | "nextPlay"
  | "addPlayList"
  | "favPlaylist"
  | "removeFromPlaylist";

export type TrackContextMenuOnClick = NormalFunc<
  [type: TrackContextMenuAction, track: NeteaseTrackRecord]
>;

export function createTrackContextMenu(props: {
  clientX: number;
  clientY: number;
  track: NeteaseTrackRecord;
  onClick?: TrackContextMenuOnClick;
  /** 是否显示「从歌单删除」（仅自建歌单页可用） */
  canRemove?: boolean;
  /** 提供后菜单才显示「查看歌手」；多歌手时展开为子菜单 */
  onClickArtist?: NormalFunc<[id: number]>;
}): ContextMenuRender {
  const { canRemove, onClick, onClickArtist, track, clientX, clientY } = props;
  return {
    header: createHeader(track),
    items: createMenuItems(track, onClick, canRemove, onClickArtist),
    clientX,
    clientY
  };
}

function createHeader(track: NeteaseTrackRecord) {
  const image = NeteaseNetworkImage.fromTrackCover(track).setSize(NeteaseImageSize.xs);
  const album = track.detail.al?.name;
  return (
    <div className="w-full h-full grid items-center grid-rows-1 grid-cols-[auto_1fr]">
      <NeteaseImage
        className={`
            size-8 rounded-md select-none
            ease-in-out duration-300 transition-all
          `}
        image={image}
        shadowColor="light"
        cache
      />
      <div className="w-full overflow-hidden flex flex-col items-start justify-center px-2 select-none truncate">
        <p className="w-full font-semibold text-left text-[12px] truncate">{track.name}</p>
        <p className="w-full font-normal text-left text-[10px] leading-4 opacity-50 truncate">
          {[track.detail.artist.join(" / "), album].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

const createLabel = (text: string) => <p className="min-w-0 truncate text-[12px]">{text}</p>;

function copyText(text: Optional<string>) {
  if (!text) return;
  window.navigator.clipboard.writeText(text).then(() => {
    AppToast.show({
      type: "success",
      text: "复制成功"
    });
  });
}

function createCopyItems(track: NeteaseTrackRecord): ContextMenuItem[] {
  return [
    { label: createLabel("歌曲名"), onClick: () => copyText(track.name) },
    { label: createLabel("歌手名"), onClick: () => copyText(track.detail.artist?.join(" ")) },
    { label: createLabel("专辑名"), onClick: () => copyText(track.detail.al?.name) },
    {
      label: createLabel("网页链接"),
      onClick: () => copyText(`https://music.163.com/song?id=${track.id}`)
    }
  ];
}

function createMenuItems(
  track: NeteaseTrackRecord,
  onClick?: TrackContextMenuOnClick,
  canRemove?: boolean,
  onClickArtist?: NormalFunc<[id: number]>
): ContextMenuItem[] {
  const { _user } = userStoreSnapshot();
  const playable = track.detail.playable(NeteaseUser.fromObject(_user));
  const items: ContextMenuItem[] = [];

  // 播放组：不可播放时整组隐藏（后续可改为置灰并标注原因）
  if (playable) {
    items.push(
      {
        prefix: <Play size={14} />,
        label: createLabel("播放"),
        onClick: () => onClick?.("play", track)
      },
      {
        prefix: <ListPlus size={14} />,
        label: createLabel("下一首播放"),
        onClick: () => onClick?.("nextPlay", track)
      },
      {
        prefix: <ListMusic size={14} />,
        label: createLabel("添加到播放列表"),
        onClick: () => onClick?.("addPlayList", track)
      },
      { separator: true }
    );
  }

  // 归属组：跳转与互动
  items.push(
    {
      prefix: <FolderPlus size={14} />,
      label: createLabel("收藏到歌单"),
      onClick: () => onClick?.("favPlaylist", track)
    },
    {
      prefix: <DiscAlbum size={14} />,
      label: createLabel("查看专辑"),
      onClick: () => onClick?.("album", track)
    }
  );
  const artists = (track.detail.ar ?? []).filter((artist) => !!artist.name);
  if (onClickArtist && artists.length > 0) {
    // 只有一位歌手时直接跳转，多位歌手时展开成子菜单让用户选
    items.push({
      prefix: <UserRound size={14} />,
      label: createLabel("查看歌手"),
      ...(artists.length === 1
        ? { onClick: () => onClickArtist(artists[0]!.id) }
        : {
            children: artists.map((artist) => ({
              label: createLabel(artist.name),
              onClick: () => onClickArtist(artist.id)
            }))
          })
    });
  }
  items.push(
    {
      prefix: <MessageSquare size={14} />,
      label: createLabel("评论"),
      suffix: <CommentCount id={track.id} />,
      onClick: () => onClick?.("comment", track)
    },
    { separator: true }
  );

  // 工具组：复制收进子菜单，避免三项平铺
  items.push(
    {
      prefix: <Copy size={14} />,
      label: createLabel("复制"),
      children: createCopyItems(track)
    },
    {
      prefix: <Info size={14} />,
      label: createLabel("歌曲信息"),
      onClick: () => onClick?.("info", track)
    }
  );

  // 危险操作单独成组
  if (canRemove) {
    items.push(
      { separator: true },
      {
        prefix: <Trash2 size={14} />,
        label: createLabel("从歌单删除"),
        danger: true,
        onClick: () => onClick?.("removeFromPlaylist", track)
      }
    );
  }

  return items;
}
