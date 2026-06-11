import {
  Clock,
  Heart,
  House,
  ListMusic,
  type LucideIcon,
  Music2,
  Sparkles,
  Trophy
} from "lucide-react";
import { type ReactNode } from "react";
import { RoutePathMain } from "@/common/routes";

export type NavData = {
  icon: ReactNode;
  label: string;
  path: string;
};

export type HomeChannelKey = "recommend" | "charts" | "playlists" | "songs-artists";

export interface HomeChannel {
  key: HomeChannelKey;
  label: string;
  caption: string;
  Icon: LucideIcon;
}

export class NavConstants {
  static readonly LAYOUT_NAV: NavData[] = [
    {
      icon: <House className="w-full aspect-square" />,
      label: "推荐",
      path: RoutePathMain.home
    },
    {
      icon: <Heart className="w-full aspect-square" />,
      label: "喜欢",
      path: RoutePathMain.playlist.like
    },
    {
      icon: <Clock className="w-full aspect-square" />,
      label: "历史",
      path: RoutePathMain.history
    }
  ];
  static readonly HOME_CHANNELS: HomeChannel[] = [
    { key: "recommend", label: "推荐", caption: "For You", Icon: Sparkles },
    { key: "charts", label: "排行榜", caption: "Charts", Icon: Trophy },
    { key: "playlists", label: "歌单", caption: "Playlists", Icon: ListMusic },
    { key: "songs-artists", label: "歌曲 / 歌手", caption: "Songs & Artists", Icon: Music2 }
  ];
}
