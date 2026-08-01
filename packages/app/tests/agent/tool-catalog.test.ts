import { LLMConversation } from "@mahiru/ai";
import {
  createAgentToolCatalog,
  buildAgentToolRoutingText
} from "@mahiru/app/inner/agent/tool-catalog";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("Agent 工具目录", () => {
  const destructiveToolNames = [
    "agent-tool-change-settings",
    "agent-tool-replace-lyrics",
    "agent-tool-track-like",
    "agent-tool-fm-trash",
    "agent-tool-playlist-create",
    "agent-tool-playlist-delete",
    "agent-tool-playlist-modify",
    "agent-tool-playlist-star",
    "agent-tool-album-star",
    "agent-tool-comment-send",
    "agent-tool-comment-like",
    "agent-tool-player-queue-remove"
  ];

  it("只根据当前轮次暴露副作用工具", () => {
    const catalog = createAgentToolCatalog(true);

    expect(catalog.select("删除这个歌单")).toContain("agent-tool-playlist-delete");
    expect(catalog.select("介绍当前歌曲")).not.toContain("agent-tool-playlist-delete");
  });

  it("核心工具保持稳定，其他能力按意图预加载", () => {
    const catalog = createAgentToolCatalog(false);
    const ordinary = catalog.select("你好，最近怎么样？");
    const music = catalog.select("介绍当前播放歌曲");

    expect(ordinary).toEqual(["agent-search", "agent-tool-capability-search"]);
    expect(music).toEqual(expect.arrayContaining(ordinary));
    expect(music).toContain("agent-tool-track-detail");
    expect(music).not.toContain("agent-tool-settings-get");
    expect(ordinary).not.toContain("agent-tool-playlist-delete");
  });

  it("短跟进句继承上一条用户意图，普通新话题不继承", () => {
    const conversation = LLMConversation.create({ id: "follow-up-routing" }).unwrap();
    conversation.appendMessage({ role: "user", content: "介绍当前播放歌曲" }).unwrap();
    conversation.appendMessage({ role: "assistant", content: "先介绍到这里。" }).unwrap();
    conversation.appendMessage({ role: "user", content: "继续" }).unwrap();

    const followUp = buildAgentToolRoutingText("继续", conversation);
    const selected = createAgentToolCatalog(false).select(followUp);

    expect(followUp).toBe("介绍当前播放歌曲\n继续");
    expect(selected).toContain("agent-tool-track-detail");
    expect(selected).toContain("agent-tool-track-comment");
    expect(buildAgentToolRoutingText("你好", conversation)).toBe("你好");

    conversation.appendMessage({ role: "assistant", content: "还可以继续。" }).unwrap();
    conversation.appendMessage({ role: "user", content: "好的" }).unwrap();
    expect(buildAgentToolRoutingText("好的", conversation)).toBe("介绍当前播放歌曲\n好的");
  });

  it("确认短句会纳入助手最近的明确提议，供 Skill 和只读工具理解", () => {
    const conversation = LLMConversation.create({ id: "assistant-proposal-routing" }).unwrap();
    conversation.appendMessage({ role: "user", content: "介绍当前播放歌曲" }).unwrap();
    conversation
      .appendMessage({
        role: "assistant",
        content: "歌曲的基础信息先介绍到这里。要不要结合动画剧情分析？"
      })
      .unwrap();
    conversation.appendMessage({ role: "user", content: "好的" }).unwrap();

    const routingText = buildAgentToolRoutingText("好的", conversation);
    const selected = createAgentToolCatalog(false).select(routingText, "好的");

    expect(routingText).toBe(
      "介绍当前播放歌曲\n<assistant_proposal>要不要结合动画剧情分析？</assistant_proposal>\n好的"
    );
    expect(selected).toContain("agent-tool-track-detail");
    expect(selected).toContain("agent-tool-web-browser");
  });

  it("短确认只授权助手最近明确提议的写操作", () => {
    const conversation = LLMConversation.create({ id: "follow-up-action-safety" }).unwrap();
    conversation.appendMessage({ role: "user", content: "删除这个歌单" }).unwrap();
    conversation.appendMessage({ role: "assistant", content: "删除这个歌单，可以吗？" }).unwrap();
    conversation.appendMessage({ role: "user", content: "好的" }).unwrap();

    const routingText = buildAgentToolRoutingText("好的", conversation);
    const selected = createAgentToolCatalog(true).select(routingText, "好的");

    expect(routingText).toBe(
      "删除这个歌单\n<assistant_proposal>删除这个歌单，可以吗？</assistant_proposal>\n好的"
    );
    expect(selected).toContain("agent-tool-playlist-delete");

    const playerRouting = "播放这首歌\n继续";
    const playerSelected = createAgentToolCatalog(false).select(playerRouting, "继续");
    expect(playerSelected).toContain("agent-tool-track-play");
    expect(playerSelected).toContain("agent-tool-player-action");
    expect(createAgentToolCatalog(false).select("继续播放")).toContain("agent-tool-player-action");
  });

  it("确认无关建议时不会继承更早的写操作", () => {
    const conversation = LLMConversation.create({ id: "unrelated-write-confirmation" }).unwrap();
    conversation.appendMessage({ role: "user", content: "删除这个歌单" }).unwrap();
    conversation.appendMessage({ role: "assistant", content: "要不要搜索相关资料？" }).unwrap();
    conversation.appendMessage({ role: "user", content: "好的" }).unwrap();

    const routingText = buildAgentToolRoutingText("好的", conversation);

    expect(createAgentToolCatalog(true).select(routingText, "好的")).not.toContain(
      "agent-tool-playlist-delete"
    );
  });

  it("没有助手确认提议时，多行旧消息不会被误判成写操作授权", () => {
    const conversation = LLMConversation.create({ id: "multiline-write-confirmation" }).unwrap();
    conversation.appendMessage({ role: "user", content: "我还在考虑\n删除这个歌单" }).unwrap();
    conversation.appendMessage({ role: "assistant", content: "明白了。" }).unwrap();
    conversation.appendMessage({ role: "user", content: "好的" }).unwrap();

    const routingText = buildAgentToolRoutingText("好的", conversation);

    expect(routingText).not.toContain("<assistant_proposal>");
    expect(createAgentToolCatalog(true).select(routingText, "好的")).not.toContain(
      "agent-tool-playlist-delete"
    );
  });

  it("无特定意图的普通对话保持相同工具定义顺序", () => {
    const catalog = createAgentToolCatalog(false);

    expect(catalog.select("你好")).toEqual(catalog.select("说个笑话"));
  });

  it.each(["介绍这个歌单", "这张专辑怎么样", "看看热门评论", "设置有哪些", "我喜欢这首歌"])(
    "名词或陈述“%s”不会暴露 destructive 工具",
    (input) => {
      const selected = createAgentToolCatalog(true).select(input);

      expect(selected.filter((name) => destructiveToolNames.includes(name))).toEqual([]);
    }
  );

  it.each([
    ["修改音质设置", "agent-tool-change-settings"],
    ["把当前歌词替换为新的逐字歌词", "agent-tool-replace-lyrics"],
    ["把这首歌曲加入喜欢", "agent-tool-track-like"],
    ["屏蔽这首歌曲", "agent-tool-fm-trash"],
    ["新建一个通勤歌单", "agent-tool-playlist-create"],
    ["删除这个歌单", "agent-tool-playlist-delete"],
    ["删除歌单里的歌曲", "agent-tool-playlist-modify"],
    ["收藏这个歌单", "agent-tool-playlist-star"],
    ["收藏这张专辑", "agent-tool-album-star"],
    ["发布一条评论", "agent-tool-comment-send"],
    ["点赞这条评论", "agent-tool-comment-like"],
    ["清空播放队列", "agent-tool-player-queue-remove"]
  ])("明确操作“%s”会暴露 %s", (input, expectedTool) => {
    expect(createAgentToolCatalog(true).select(input)).toContain(expectedTool);
  });

  it("为创作背景和剧情取证追问提供网页工具", () => {
    const catalog = createAgentToolCatalog(false);

    expect(catalog.select("那它的创作背景呢？")).toContain("agent-tool-web-browser");
    expect(catalog.select("结合剧情讲讲")).toContain("agent-tool-web-browser");
  });

  it("能力搜索可以在下一步按需加载未预选的只读工具", async () => {
    const catalog = createAgentToolCatalog(false);
    const directory = catalog.list.find((tool) => tool.name === "agent-tool-capability-search");
    const activateTools = vi.fn();

    const result = await directory?.execute(
      { query: "查看播放历史" },
      {
        conversationID: "capability-search",
        outputDetail: "standard",
        activateTools
      }
    );

    expect(result?.isOk()).toBe(true);
    expect(activateTools).toHaveBeenCalledWith(
      expect.arrayContaining(["agent-tool-user-play-history"])
    );
    expect(catalog.deferredNames).toContain("agent-tool-user-play-history");
    expect(catalog.deferredNames).not.toContain("agent-tool-capability-search");
  });

  it("把“当前播放”作为歌曲指代时不会误暴露播放器控制组", () => {
    const catalog = createAgentToolCatalog(false);
    const selected = catalog.select("结合《86》的动画剧情，介绍当前播放歌曲并解释情绪来源");

    expect(selected).toContain("agent-tool-track-detail");
    expect(selected).not.toContain("agent-tool-player-action");
    expect(selected).not.toContain("agent-tool-player-mode");
    expect(selected).not.toContain("agent-tool-player-queue-add");
    expect(selected).not.toContain("agent-tool-track-play");
    expect(catalog.select("请播放晴天")).toContain("agent-tool-player-action");
    expect(catalog.select("请播放晴天")).toContain("agent-tool-track-play");
    expect(catalog.select("当前播放状态是什么")).toContain("agent-tool-player-current");
    expect(catalog.select("现在播放到哪里了")).toContain("agent-tool-player-current");
    expect(catalog.select("这首歌能否播放")).toContain("agent-tool-track-playable");
    expect(catalog.select("找一些相似歌曲")).toContain("agent-tool-track-similar");
  });

  it.each([
    "播放晴天",
    "现在播放晴天",
    "麻烦播放一下晴天",
    "放晴天",
    "播晴天",
    "放首晴天",
    "来首晴天"
  ])("常用播放表达“%s”会保留播放能力", (input) => {
    const selected = createAgentToolCatalog(false).select(input);

    expect(selected).toContain("agent-tool-player-action");
    expect(selected).toContain("agent-tool-track-play");
  });

  it.each(["这首歌能听吗", "这首歌能不能听", "这首歌可不可以听"])(
    "可播放性表达“%s”会保留检查能力",
    (input) => {
      expect(createAgentToolCatalog(false).select(input)).toContain("agent-tool-track-playable");
    }
  );

  it.each([
    ["我想创建一个歌单", "agent-tool-playlist-create"],
    ["能不能新建歌单", "agent-tool-playlist-create"],
    ["请你收藏这张专辑", "agent-tool-album-star"],
    ["麻烦你收藏这个歌单", "agent-tool-playlist-star"]
  ])("礼貌或意愿表达“%s”不会丢失 %s", (input, expectedTool) => {
    expect(createAgentToolCatalog(true).select(input)).toContain(expectedTool);
  });

  it("评论取证默认只读取足够形成观点样本的十条结果", () => {
    const tool = createAgentToolCatalog(false).list.find(
      (item) => item.name === "agent-tool-track-comment"
    );

    expect(tool?.inputSchema.parse({ id: 1, type: "track" })).toMatchObject({
      page: 1,
      pageSize: 10,
      sort: "hot"
    });
  });

  it("资源搜索默认返回十条并保留显式分页能力", () => {
    const tool = createAgentToolCatalog(false).list.find((item) => item.name === "agent-search");

    expect(tool?.inputSchema.parse({ keyword: "ANIMA", type: "track" })).toMatchObject({
      page: 1,
      pageSize: 10
    });
    expect(
      tool?.inputSchema.safeParse({ keyword: "ANIMA", type: "track", pageSize: 20 }).success
    ).toBe(true);
    expect(
      tool?.inputSchema.safeParse({ keyword: "ANIMA", type: "track", pageSize: 21 }).success
    ).toBe(false);
  });

  it("只复用稳定资料查询，不缓存会随播放或设置变化的实时状态", () => {
    const catalog = createAgentToolCatalog(false);

    expect(catalog.reuseSafeNames).toContain("agent-tool-web-browser");
    expect(catalog.reuseSafeNames).toContain("agent-tool-track-detail");
    expect(catalog.reuseSafeNames).not.toContain("agent-tool-player-current");
    expect(catalog.reuseSafeNames).not.toContain("agent-tool-player-queue");
    expect(catalog.reuseSafeNames).not.toContain("agent-tool-settings-get");
  });

  it("歌词读取默认使用语义模式，按需保留可编辑逐字结构", () => {
    const tool = createAgentToolCatalog(false).list.find(
      (item) => item.name === "agent-tool-track-lyrics"
    );

    expect(tool?.inputSchema.parse({ id: 1 })).toEqual({ id: 1, mode: "semantic" });
    expect(tool?.inputSchema.parse({ id: 1, mode: "editable" })).toEqual({
      id: 1,
      mode: "editable"
    });
  });
});
