import type { LLMTool } from "@mahiru/ai";

import { AgentToolWebBrowser } from "./agent-tool-web-browser";
import {
  AgentToolRecord,
  AgentToolSearch,
  AgentToolComment,
  AgentToolFMTrash,
  AgentToolTrackFM,
  AgentToolAlbumNew,
  AgentToolUserInfo,
  AgentToolAlbumStar,
  AgentToolSearchHot,
  AgentToolTrackLike,
  AgentToolTrackPlay,
  AgentToolArtistDesc,
  AgentToolPlayerMode,
  AgentToolPlayerSeek,
  AgentToolSearchOpen,
  AgentToolSourceOpen,
  AgentToolAlbumDetail,
  AgentToolCommentLike,
  AgentToolCommentOpen,
  AgentToolCommentSend,
  AgentToolLyricSchema,
  AgentToolPlayerQueue,
  AgentToolPlaylistTop,
  AgentToolSettingsGet,
  AgentToolTrackDetail,
  AgentToolTrackLyrics,
  AgentToolArtistAlbums,
  AgentToolArtistDetail,
  AgentToolHomeToplists,
  AgentToolPlayerAction,
  AgentToolPlayerVolume,
  AgentToolPlaylistStar,
  AgentToolTrackSimilar,
  AgentToolArtistSimilar,
  AgentToolArtistToplist,
  AgentToolPlayerCurrent,
  AgentToolReplaceLyrics,
  AgentToolSearchSuggest,
  AgentToolTrackPlayable,
  AgentToolUserPlaylists,
  AgentToolChangeSettings,
  AgentToolPlayerQueueAdd,
  AgentToolPlaylistCreate,
  AgentToolPlaylistDelete,
  AgentToolPlaylistDetail,
  AgentToolPlaylistModify,
  AgentToolArtistHotTracks,
  AgentToolPlaylistSimilar,
  AgentToolUserPlayHistory,
  AgentToolPlayerQueueRemove,
  AgentToolPlaylistRecommend,
  AgentToolTrackRecommendNew,
  AgentToolTrackRecommendDaily
} from "./tools";

const CoreToolNames = ["agent-search"] as const;

const ToolGroups = {
  track: ["agent-tool-track-detail", "agent-tool-track-comment", "agent-tool-track-lyrics"],
  trackAvailability: ["agent-tool-track-playable"],
  trackSimilarity: ["agent-tool-track-similar"],
  player: [
    "agent-tool-player-action",
    "agent-tool-player-current",
    "agent-tool-player-mode",
    "agent-tool-player-queue",
    "agent-tool-player-queue-add",
    "agent-tool-player-seek",
    "agent-tool-player-volume",
    "agent-tool-track-play"
  ],
  lyric: ["agent-lyric-schema", "agent-tool-replace-lyrics", "agent-tool-track-lyrics"],
  navigation: ["agent-tool-comment-open", "agent-tool-search-open", "agent-tool-source-open"],
  user: [
    "agent-tool-record",
    "agent-tool-user-info",
    "agent-tool-user-play-history",
    "agent-tool-user-playlists"
  ],
  discovery: [
    "agent-tool-album-new",
    "agent-tool-home-toplists",
    "agent-tool-playlist-recommend",
    "agent-tool-playlist-similar",
    "agent-tool-playlist-top",
    "agent-tool-search-hot",
    "agent-tool-search-suggest",
    "agent-tool-track-fm",
    "agent-tool-track-recommend-daily",
    "agent-tool-track-recommend-new"
  ],
  artist: [
    "agent-tool-artist-detail",
    "agent-tool-artist-albums",
    "agent-tool-artist-desc",
    "agent-tool-artist-hot-tracks",
    "agent-tool-artist-similar",
    "agent-tool-artist-toplist"
  ],
  playlist: [
    "agent-tool-playlist-detail",
    "agent-tool-playlist-recommend",
    "agent-tool-playlist-similar",
    "agent-tool-playlist-top",
    "agent-tool-user-playlists"
  ],
  album: ["agent-tool-album-detail", "agent-tool-album-new"],
  comment: ["agent-tool-comment-open", "agent-tool-track-comment"],
  settings: ["agent-tool-settings-get"],
  web: ["agent-tool-web-browser"]
} as const;

type AgentToolGroup = keyof typeof ToolGroups;

// “当前播放歌曲”通常只是指代当前曲目，只有明确的控制或状态意图才加载播放器工具。
const PlayerIntentPattern =
  /(?:^|[，。！？!?]\s*|请(?:你)?|麻烦(?:你)?|帮我|替我|给我|我要|我想(?:要)?|想要|需要|现在)(?:播放|放(?:一下|一?首)?|播(?:一下)?|来(?:一)?首|听(?:一下|一?首)?)|(?:把|将).{0,24}(?:播放|放一下|播一下)|暂停|继续(?:播放)?|上一首|下一首|音量|静音|进度|跳转|队列|(?:当前|现在|正在)(?:播放)?.{0,8}(?:状态|进度|到哪(?:里)?|什么|哪首)|player|queue/i;

const GroupPatterns: ReadonlyArray<readonly [AgentToolGroup, RegExp]> = [
  ["track", /歌曲?|单曲|song|track/i],
  [
    "trackAvailability",
    /版权|能否播放|可以播放|无法播放|播放不了|不可播放|能(?:不能)?听(?:吗)?|可不可以听/i
  ],
  ["trackSimilarity", /相似|类似|同风格|similar/i],
  ["player", PlayerIntentPattern],
  ["lyric", /歌词|罗马音|翻译|逐字|lyric/i],
  ["navigation", /打开|跳到|进入.+(?:页面|界面)|open/i],
  ["user", /登录|账号|用户信息|我的歌单|播放历史|听歌统计|本周听歌|user|history/i],
  ["discovery", /推荐|发现|热搜|新歌|榜单|排行|私人\s*fm|每日|discover|recommend|toplist/i],
  ["artist", /歌手|艺人|艺术家|乐队|artist|singer/i],
  ["playlist", /歌单|播放列表|playlist/i],
  ["album", /专辑|唱片|album/i],
  ["comment", /评论|回复|点赞|comment/i],
  ["settings", /设置|配置|音质|性能|频谱|背景效果|setting/i],
  [
    "web",
    /网页|网站|互联网|联网|最新资料|新闻|官网|创作背景|发行背景|创作故事|幕后|作者访谈|制作人访谈|结合剧情|剧情关联|角色关系|资料来源|web|internet|online|site:/i
  ]
];

/**
 * 副作用工具不能仅凭“歌单”“评论”等名词进入模型上下文，必须匹配明确的操作意图。
 * 这些规则只决定是否暴露工具，工具执行前仍会经过 destructive 权限校验。
 */
const DestructiveToolPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "agent-tool-change-settings",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:修改|更改|调整|开启|关闭|切换).*(?:设置|配置|音质|性能|频谱|背景效果)|(?:把|将).*(?:设置|配置|音质|性能|频谱|背景效果).*(?:改|调|设|开启|关闭|切换)|设置.+(?:为|成))/i
  ],
  [
    "agent-tool-track-like",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:把|将|给).*(?:歌曲|这首|当前单曲).*(?:喜欢|收藏|取消喜欢|取消收藏|移出喜欢)|(?:加入|移出|取消).*(?:喜欢|红心))/i
  ],
  [
    "agent-tool-fm-trash",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:屏蔽|丢弃|不再播放).*(?:这首|歌曲|单曲)|从私人\s*FM\s*移除.*(?:这首|歌曲|单曲)?)/i
  ],
  [
    "agent-tool-playlist-create",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:创建|新建|建立).*(?:歌单|播放列表)/i
  ],
  [
    "agent-tool-playlist-delete",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:删除|删掉|移除).*(?:歌单|播放列表)(?!\s*(?:里|中|内|的).*(?:歌曲|单曲))/i
  ],
  [
    "agent-tool-playlist-modify",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:把|将).*(?:歌曲|单曲).*(?:添加|加入|移除|删除).*(?:歌单|播放列表)|(?:给|把|将).*(?:歌单|播放列表).*(?:添加|加入|移除|删除).*(?:歌曲|单曲)|从.*(?:歌单|播放列表).*(?:移除|删除).*(?:歌曲|单曲)|(?:添加|加入|移除|删除).*(?:歌单|播放列表)(?:里|中|内|的).*(?:歌曲|单曲))/i
  ],
  [
    "agent-tool-playlist-star",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:收藏|取消收藏).*(?:歌单|播放列表)|(?:把|将).*(?:歌单|播放列表).*(?:收藏|取消收藏))/i
  ],
  [
    "agent-tool-album-star",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:收藏|取消收藏).*(?:专辑|唱片)|(?:把|将).*(?:专辑|唱片).*(?:收藏|取消收藏))/i
  ],
  [
    "agent-tool-comment-send",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:发送|发布|发表|回复|写).*(?:评论|回复)/i
  ],
  [
    "agent-tool-comment-like",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:点赞|取消点赞).*(?:评论|回复|这条)|(?:给|把|将).*(?:评论|回复|这条).*(?:点赞|取消点赞))/i
  ],
  [
    "agent-tool-player-queue-remove",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要|能不能|可不可以)?\s*(?:(?:清空|移除|删除).*(?:播放)?队列|从(?:播放)?队列.*(?:移除|删除))/i
  ]
];

const ActionToolNames = new Set([
  "agent-tool-album-star",
  "agent-tool-change-settings",
  "agent-tool-comment-like",
  "agent-tool-comment-open",
  "agent-tool-comment-send",
  "agent-tool-fm-trash",
  "agent-tool-player-action",
  "agent-tool-player-mode",
  "agent-tool-player-queue-add",
  "agent-tool-player-queue-remove",
  "agent-tool-player-seek",
  "agent-tool-player-volume",
  "agent-tool-playlist-create",
  "agent-tool-playlist-delete",
  "agent-tool-playlist-modify",
  "agent-tool-playlist-star",
  "agent-tool-replace-lyrics",
  "agent-tool-search-open",
  "agent-tool-source-open",
  "agent-tool-track-like",
  "agent-tool-track-play"
]);

export interface AgentToolCatalog {
  list: LLMTool[];
  parallelSafeNames: string[];
  select(routingText: string): string[];
}

export function createAgentToolCatalog(enableDestructive: boolean): AgentToolCatalog {
  const safe: LLMTool[] = [
    new AgentToolSearch(),
    new AgentToolComment(),
    new AgentToolTrackDetail(),
    new AgentToolAlbumDetail(),
    new AgentToolArtistDetail(),
    new AgentToolPlayerAction(),
    new AgentToolTrackLyrics(),
    new AgentToolTrackSimilar(),
    new AgentToolTrackPlayable(),
    new AgentToolPlaylistDetail(),
    new AgentToolTrackPlay(),
    new AgentToolReplaceLyrics(),
    new AgentToolLyricSchema(),
    new AgentToolSourceOpen(),
    new AgentToolSearchOpen(),
    new AgentToolCommentOpen(),
    new AgentToolPlayerCurrent(),
    new AgentToolPlayerVolume(),
    new AgentToolPlayerSeek(),
    new AgentToolPlayerQueue(),
    new AgentToolPlayerQueueAdd(),
    new AgentToolPlayerMode(),
    new AgentToolUserInfo(),
    new AgentToolUserPlaylists(),
    new AgentToolUserPlayHistory(),
    new AgentToolTrackRecommendDaily(),
    new AgentToolTrackRecommendNew(),
    new AgentToolTrackFM(),
    new AgentToolArtistHotTracks(),
    new AgentToolArtistAlbums(),
    new AgentToolArtistSimilar(),
    new AgentToolArtistToplist(),
    new AgentToolArtistDesc(),
    new AgentToolPlaylistRecommend(),
    new AgentToolPlaylistSimilar(),
    new AgentToolPlaylistTop(),
    new AgentToolAlbumNew(),
    new AgentToolSearchHot(),
    new AgentToolSearchSuggest(),
    new AgentToolHomeToplists(),
    new AgentToolSettingsGet(),
    new AgentToolRecord(),
    new AgentToolWebBrowser()
  ];
  const destructive: LLMTool[] = [
    new AgentToolChangeSettings(),
    new AgentToolTrackLike(),
    new AgentToolFMTrash(),
    new AgentToolPlaylistCreate(),
    new AgentToolPlaylistDelete(),
    new AgentToolPlaylistModify(),
    new AgentToolPlaylistStar(),
    new AgentToolAlbumStar(),
    new AgentToolCommentSend(),
    new AgentToolCommentLike(),
    new AgentToolPlayerQueueRemove()
  ];
  const list = enableDestructive ? [...safe, ...destructive] : safe;
  const available = new Set(list.map((tool) => tool.name));

  return {
    list,
    parallelSafeNames: list.map((tool) => tool.name).filter((name) => !ActionToolNames.has(name)),
    select(routingText) {
      const selected = new Set<string>(CoreToolNames);
      for (const [group, pattern] of GroupPatterns) {
        if (!pattern.test(routingText)) continue;
        for (const name of ToolGroups[group]) selected.add(name);
      }
      for (const [name, pattern] of DestructiveToolPatterns) {
        if (pattern.test(routingText)) selected.add(name);
      }
      return list
        .map((tool) => tool.name)
        .filter((name) => selected.has(name) && available.has(name));
    }
  };
}
