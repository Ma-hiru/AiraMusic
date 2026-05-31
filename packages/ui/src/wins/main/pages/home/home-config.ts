import { Disc3, ListMusic, Music2, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HomeChannelKey = "recommend" | "charts" | "playlists" | "songs-artists";

export interface HomeChannel {
  key: HomeChannelKey;
  label: string;
  caption: string;
  Icon: LucideIcon;
}

export const HOME_CHANNELS: HomeChannel[] = [
  { key: "recommend", label: "推荐", caption: "For You", Icon: Sparkles },
  { key: "charts", label: "排行榜", caption: "Charts", Icon: Trophy },
  { key: "playlists", label: "歌单", caption: "Playlists", Icon: ListMusic },
  { key: "songs-artists", label: "歌曲 / 歌手", caption: "Songs & Artists", Icon: Music2 }
];

export const HOME_FEATURED_TOPLIST_IDS = [19723756, 180106, 60198, 3812895, 60131];

export const HOME_PRIMARY_PLAYLIST_CATEGORIES = [
  "推荐歌单",
  "精品歌单",
  "官方",
  "排行榜",
  "欧美",
  "流行",
  "摇滚",
  "电子",
  "说唱",
  "ACG"
];

export const HOME_PLAYLIST_CATEGORY_GROUPS = [
  {
    name: "入口",
    categories: ["全部", "推荐歌单", "精品歌单", "官方", "排行榜"]
  },
  {
    name: "语种",
    categories: ["华语", "欧美", "日语", "韩语", "粤语"]
  },
  {
    name: "风格",
    categories: [
      "流行",
      "摇滚",
      "民谣",
      "电子",
      "舞曲",
      "说唱",
      "轻音乐",
      "爵士",
      "乡村",
      "R&B/Soul",
      "古典",
      "民族",
      "英伦",
      "金属",
      "朋克",
      "蓝调",
      "雷鬼",
      "世界音乐",
      "拉丁",
      "New Age",
      "古风",
      "后摇",
      "Bossa Nova"
    ]
  },
  {
    name: "场景",
    categories: [
      "清晨",
      "夜晚",
      "学习",
      "工作",
      "午休",
      "下午茶",
      "地铁",
      "驾车",
      "运动",
      "旅行",
      "散步",
      "酒吧"
    ]
  },
  {
    name: "情感",
    categories: [
      "怀旧",
      "清新",
      "浪漫",
      "伤感",
      "治愈",
      "放松",
      "孤独",
      "感动",
      "兴奋",
      "快乐",
      "安静",
      "思念"
    ]
  },
  {
    name: "主题",
    categories: [
      "综艺",
      "影视原声",
      "ACG",
      "儿童",
      "校园",
      "游戏",
      "70后",
      "80后",
      "90后",
      "网络歌曲",
      "KTV",
      "经典",
      "翻唱",
      "吉他",
      "钢琴",
      "器乐",
      "榜单",
      "00后"
    ]
  }
];

export const HOME_SONG_AREAS = [
  { label: "全部", caption: "All", type: 0 },
  { label: "华语", caption: "Mandarin", type: 7 },
  { label: "欧美", caption: "Western", type: 96 },
  { label: "日本", caption: "Japan", type: 8 },
  { label: "韩国", caption: "Korea", type: 16 }
] as const;

export const HOME_ARTIST_AREAS = [
  { label: "全部", caption: "All", type: undefined },
  { label: "华语", caption: "Mandarin", type: 1 },
  { label: "欧美", caption: "Western", type: 2 },
  { label: "韩国", caption: "Korea", type: 3 },
  { label: "日本", caption: "Japan", type: 4 }
] as const;

export const HOME_PLAYLIST_CHANNEL_ICON = {
  推荐歌单: Sparkles,
  精品歌单: Disc3,
  排行榜: Trophy
} satisfies Record<string, LucideIcon>;
