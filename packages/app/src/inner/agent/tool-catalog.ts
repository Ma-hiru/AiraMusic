import { z } from "zod";
import { LLMTool, AIResult, type LLMToolContext, type LLMConversation } from "@mahiru/ai";

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

const CapabilitySearchToolName = "agent-tool-capability-search";
const CoreToolNames = ["agent-search", CapabilitySearchToolName] as const;

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
  lyric: ["agent-lyric-schema", "agent-tool-track-lyrics"],
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

// “当前播放歌曲”通常只是指代当前曲目，只有明确控制或状态意图才加载播放器工具。
const PlayerIntentPattern =
  /(?:^|[，。！？!?]\s*|请(?:你)?|麻烦(?:你)?|帮我|替我|给我|我要|我想(?:要)?|想要|需要|现在)(?:播放|放(?:一下|一?首)?|播(?:一下)?|来(?:一)?首|听(?:一下|一?首)?)|(?:把|将).{0,24}(?:播放|放一下|播一下)|暂停(?:播放)?|继续播放|上一首|下一首|音量|静音|进度|跳转|队列|(?:当前|现在|正在)(?:播放)?.{0,8}(?:状态|进度|到哪(?:里)?|什么|哪首)|player|queue/i;

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
    /网页|网站|互联网|联网|最新资料|新闻|官网|创作背景|发行背景|创作故事|幕后|作者访谈|制作人访谈|结合.{0,8}(?:剧情|角色|场景|世界观)|剧情关联|角色关系|资料来源|web|internet|online|site:/i
  ]
];

const CapabilitySearchInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .describe("用简短中文描述要完成的能力，例如‘查看播放历史’‘获取艺人专辑’")
});

/** 只暴露一个小型目录工具，按需加载完整 schema，避免每步重放全部工具。 */
class AgentToolCapabilitySearch extends LLMTool<typeof CapabilitySearchInputSchema> {
  readonly inputSchema = CapabilitySearchInputSchema;

  constructor(private readonly candidates: readonly LLMTool[]) {
    super({
      name: CapabilitySearchToolName,
      description:
        "按需查找并加载当前未显示的 AiraMusic 能力。只在现有工具不足以完成用户请求时调用；不要用它罗列全部工具。"
    });
  }

  async execute(
    input: z.infer<typeof CapabilitySearchInputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<unknown>> {
    const query = normalizeCapabilitySearchText(input.query);
    const terms = Array.from(
      new Set(
        input.query
          .toLocaleLowerCase()
          .split(/[\s，。；：、,.;:!?_——-]+/)
          .map((term) => term.trim())
          .filter((term) => term.length >= 2)
      )
    );
    const hanChars = Array.from(input.query).filter((character) =>
      /\p{Script=Han}/u.test(character)
    );
    const hanBigrams = hanChars
      .slice(0, -1)
      .map((character, index) => `${character}${hanChars[index + 1]}`);
    const matches = this.candidates
      .map((tool) => {
        const haystack = normalizeCapabilitySearchText(`${tool.name} ${tool.description}`);
        let score = haystack.includes(query) ? 100 : 0;
        for (const term of terms) {
          if (haystack.includes(normalizeCapabilitySearchText(term))) score += 20;
        }
        for (const term of hanBigrams) {
          if (haystack.includes(term)) score += 4;
        }
        return { tool, score };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name)
      )
      .slice(0, 6)
      .map(({ tool }) => ({
        name: tool.name,
        description: tool.description.slice(0, 240)
      }));
    const activated = matches.map((match) => match.name);
    context.activateTools?.(activated);
    return AIResult.ok({
      query: input.query,
      activated,
      capabilities: matches,
      message: activated.length
        ? "匹配的工具已加载，请在下一步直接调用。"
        : "未找到匹配能力，请改用更具体的任务描述。"
    });
  }
}

function normalizeCapabilitySearchText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const FollowUpIntentPattern =
  /^(?:继续|接着|然后|更多|详细(?:一点|点)?|展开(?:说说)?|再(?:看看|试试|来|查|找|打开|播放|说|讲|详细)|这个|那个|它|这首|那首|好|好的|可以)(?:[吧呀啊呢嘛，。！？!?~\s]|$)/i;

const ConfirmationIntentPattern =
  /^(?:继续|接着|然后|好(?:的)?|可以(?:的)?|行|没问题|嗯+)(?:[吧呀啊呢嘛，。！？!?~\s]*)$/i;

const AssistantProposalRoutingStart = "<assistant_proposal>";
const AssistantProposalRoutingEnd = "</assistant_proposal>";

const AssistantProposalPattern =
  /(?:要不要|是否(?:要|需要|继续)|需不需要|想不想|需要我|要我|建议(?:你)?|(?:我可以|接下来可以|还可以|也可以).{0,80}(?:结合|分析|解释|介绍|查看|搜索|查询|读取|打开|播放|创建|删除|修改|补充|展开)|(?:可以|好|行)吗[？?]?)/i;

function extractAssistantProposal(content: string): string | undefined {
  const clauses = content.match(/[^。！？!?\n]+[。！？!?]?/g) ?? [];
  return clauses
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0 && clause.length <= 240)
    .findLast((clause) => AssistantProposalPattern.test(clause));
}

/**
 * 短跟进句继承上一条用户意图，避免动态工具路由在“继续”等输入上突然退化。
 * 确认短句还会带上助手最近明确提出的一条建议，供 Skill 和只读工具理解确认分支。
 * 当前消息通常已写入会话，因此需要显式跳过末尾与 input 相同的用户消息；
 * 写操作只会在原始输入明确要求，或用户确认助手最近提议时进入本轮能力集合。
 */
export function buildAgentToolRoutingText(input: string, conversation: LLMConversation): string {
  const current = input.trim();
  if (!FollowUpIntentPattern.test(current)) return current;

  const messages = conversation.toMessages();
  const latestMessage = messages.at(-1);
  const historyMessages =
    latestMessage?.role === "user" && latestMessage.content?.trim() === current
      ? messages.slice(0, -1)
      : messages;
  const userMessages = historyMessages.flatMap((message) => {
    const content = message.content?.trim();
    if (message.role !== "user" || !content) return [];
    return [content];
  });
  const previous =
    userMessages.findLast((message) => !FollowUpIntentPattern.test(message)) ?? userMessages.at(-1);
  const latestAssistantMessage = historyMessages.findLast(
    (message) => message.role === "assistant" && message.content?.trim()
  );
  const latestAssistantContent = latestAssistantMessage?.content?.trim();
  const proposal =
    ConfirmationIntentPattern.test(current) && latestAssistantContent
      ? extractAssistantProposal(latestAssistantContent)
      : undefined;

  const taggedProposal = proposal
    ? `${AssistantProposalRoutingStart}${proposal}${AssistantProposalRoutingEnd}`
    : undefined;
  return [previous, taggedProposal, current].filter(Boolean).join("\n");
}

/**
 * 写操作不能仅凭“歌单”“评论”等名词进入模型上下文，必须匹配明确操作或最近确认。
 * 未进入本轮集合的写工具既不会发送 schema，也不能执行。
 */
const DestructiveToolPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "agent-tool-replace-lyrics",
    /^(?:请(?:你)?|麻烦(?:你)?|帮我|替我|我要|我想(?:要)?|想要|需要)?\s*(?:(?:替换|修改|保存|写入|更新).*(?:歌词|逐字歌词)|(?:把|将).*(?:歌词|逐字歌词).*(?:替换|修改|保存|写入|更新))/i
  ],
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
  deferredNames: string[];
  reuseSafeNames: string[];
  parallelSafeNames: string[];
  select(routingText: string, actionText?: string): string[];
}

const ReuseSafeToolNames = new Set([
  "agent-search",
  CapabilitySearchToolName,
  "agent-tool-web-browser",
  "agent-tool-track-detail",
  "agent-tool-album-detail",
  "agent-tool-artist-detail",
  "agent-tool-artist-desc",
  "agent-tool-playlist-detail",
  "agent-tool-track-lyrics",
  "agent-tool-track-comment",
  "agent-tool-track-similar",
  "agent-tool-track-playable"
]);

export function createAgentToolCatalog(enableDestructive: boolean): AgentToolCatalog {
  const safeCapabilities: LLMTool[] = [
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
  const safe: LLMTool[] = [
    safeCapabilities[0]!,
    new AgentToolCapabilitySearch(safeCapabilities),
    ...safeCapabilities.slice(1)
  ];
  const destructive: LLMTool[] = [
    new AgentToolReplaceLyrics(),
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
  const deferredNames = safeCapabilities
    .map((tool) => tool.name)
    .filter((name) => !(CoreToolNames as readonly string[]).includes(name));

  return {
    list,
    deferredNames,
    parallelSafeNames: list.map((tool) => tool.name).filter((name) => !ActionToolNames.has(name)),
    reuseSafeNames: list.map((tool) => tool.name).filter((name) => ReuseSafeToolNames.has(name)),
    select(routingText, actionText = routingText) {
      const selected = new Set<string>(CoreToolNames);
      for (const [group, pattern] of GroupPatterns) {
        if (!pattern.test(routingText)) continue;
        for (const name of ToolGroups[group]) selected.add(name);
      }

      const confirmedProposal = ConfirmationIntentPattern.test(actionText);
      const proposalStart = routingText.lastIndexOf(AssistantProposalRoutingStart);
      const proposalEnd = routingText.lastIndexOf(AssistantProposalRoutingEnd);
      const latestProposal =
        proposalStart >= 0 && proposalEnd > proposalStart
          ? routingText.slice(proposalStart + AssistantProposalRoutingStart.length, proposalEnd)
          : "";
      const writeIntent = confirmedProposal && latestProposal ? latestProposal : actionText;
      if (enableDestructive) {
        for (const [name, pattern] of DestructiveToolPatterns) {
          if (pattern.test(writeIntent)) selected.add(name);
        }
      }
      return list
        .map((tool) => tool.name)
        .filter((name) => selected.has(name) && available.has(name));
    }
  };
}
