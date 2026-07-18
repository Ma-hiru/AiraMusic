import { it, vi, expect, describe, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  openDisplay: vi.fn(() => Promise.resolve()),
  deliverDisplay: vi.fn(),
  playlistResultListener: undefined as
    | undefined
    | ((result: { ok: boolean; error?: string; requestID: string }) => void),
  deliverPlaylist: vi.fn((action: { requestID?: string }) => {
    if (!action.requestID) return;
    queueMicrotask(() =>
      mocks.playlistResultListener?.({ requestID: action.requestID!, ok: true })
    );
  }),
  showToast: vi.fn(),
  loadTrack: vi.fn()
}));

vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: {
    MessageChannel: {
      listen: vi.fn(
        (
          _channel: string,
          _target: string,
          listener: (result: { ok: boolean; error?: string; requestID: string }) => void
        ) => {
          mocks.playlistResultListener = listener;
          return () => {
            if (mocks.playlistResultListener === listener) {
              mocks.playlistResultListener = undefined;
            }
          };
        }
      )
    }
  }
}));

vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    display: { reactReadyAwait: mocks.openDisplay }
  }
}));

vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    display: { deliver: mocks.deliverDisplay },
    playlistAction: { deliver: mocks.deliverPlaylist }
  }
}));

vi.mock("@/common/components/display/toast", () => ({
  default: { show: mocks.showToast }
}));

vi.mock("@/common/components/display/image/netease-image", () => ({
  default: ({ image, fallback }: { fallback?: ReactNode; image?: { src?: string } }) =>
    image?.src ? <img alt="资源封面" src={image.src} /> : fallback
}));

vi.mock("@/common/netease/models", () => {
  const image = {
    src: "https://example.com/cover.jpg",
    setAlt() {
      return this;
    },
    setSize() {
      return this;
    }
  };
  return {
    NeteaseNetworkImage: {
      fromURL: () => image,
      fromAlbumCover: () => image,
      fromTrackCover: () => image,
      fromPlaylistCover: () => image
    }
  };
});

vi.mock("@/common/netease/services", () => ({
  NeteaseServicesTrack: { id: mocks.loadTrack },
  NeteaseServicesAlbum: { id: vi.fn() },
  NeteaseServicesArtist: { id: vi.fn() },
  NeteaseServicesPlaylist: { id: vi.fn() }
}));

import MarkdownContent from "@mahiru/ui/wins/agent/page/chat/markdown-content";

const track = {
  id: 123,
  name: "示例歌曲",
  dt: 213_000,
  ar: [{ name: "示例歌手" }],
  al: { id: 9, name: "示例专辑", picUrl: "https://example.com/cover.jpg" },
  translateAndAliaName: () => "示例译名"
};

describe("Agent 富内容", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.playlistResultListener = undefined;
    mocks.loadTrack.mockResolvedValue(track);
  });

  it("把应用资源链接拦截为播放器动作", async () => {
    render(<MarkdownContent content="可以听听[示例歌曲](aira://track/123)。" />);

    fireEvent.click(await screen.findByRole("button", { name: "示例歌曲" }));

    expect(mocks.deliverPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "playTrack",
        trackID: 123,
        requestID: expect.any(String)
      })
    );
  });

  it("渲染歌曲专属卡片并支持加入下一首", async () => {
    render(
      <MarkdownContent
        content={'介绍正文。\n\n```aira-card\n{"kind":"track","id":123,"variant":"featured"}\n```'}
      />
    );

    expect(await screen.findByText("示例歌曲")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入队列示例歌曲" }));

    expect(mocks.deliverPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addToPlaylistNext",
        trackID: 123,
        sourceID: 0,
        sourceType: "other",
        requestID: expect.any(String)
      })
    );
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({ type: "success", text: "已加入下一首" })
    );
  });

  it("流式阶段只显示骨架，完成后才请求卡片数据", async () => {
    const card = '```aira-card\n{"kind":"track","id":123}\n```';
    const view = render(<MarkdownContent content={`${card}\n第一段`} streaming />);
    expect(screen.getByLabelText("正在生成音乐资源卡片")).toBeInTheDocument();
    expect(mocks.loadTrack).not.toHaveBeenCalled();

    view.rerender(<MarkdownContent content={`${card}\n第一段，继续生成。`} />);

    await screen.findByText("示例歌曲");
    expect(mocks.loadTrack).toHaveBeenCalledTimes(1);
  });

  it("隐藏尚未闭合的流式卡片源码", () => {
    render(
      <MarkdownContent content={'前文。\n\n```aira-card\n{"kind":"track","id":123'} streaming />
    );

    expect(screen.getByText("前文。")).toBeInTheDocument();
    expect(screen.getByLabelText("正在生成音乐资源卡片")).toBeInTheDocument();
    expect(screen.queryByText(/kind.*track/)).not.toBeInTheDocument();
    expect(mocks.loadTrack).not.toHaveBeenCalled();
  });

  it("非法卡片按普通 Markdown 降级，不触发资源请求", () => {
    render(
      <MarkdownContent content={'```aira-card\n{"kind":"track","id":123,"dangerous":true}\n```'} />
    );

    expect(mocks.loadTrack).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("歌曲：示例歌曲")).not.toBeInTheDocument();
  });

  it("只转换 Markdown 正文链接，不改写代码和转义示例", async () => {
    const source = [
      "[正文歌曲](aira://track/123)",
      "`[行内代码](aira://track/123)`",
      "\\[转义示例](aira://track/123)",
      "```markdown",
      "[围栏代码](aira://track/123)",
      "```"
    ].join("\n");
    render(<MarkdownContent content={source} />);

    expect(await screen.findByRole("button", { name: "正文歌曲" })).toBeInTheDocument();
    expect(screen.getByText(/行内代码/)).toBeInTheDocument();
    expect(screen.getByText(/围栏代码/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("保留 Streamdown 默认 GFM，正确渲染 Markdown 表格", async () => {
    const source = [
      "对比如下：",
      "",
      "| 歌曲 | 歌手 |",
      "| --- | --- |",
      "| STYX HELIX | MYTH & ROID |",
      "| 前前前世 | RADWIMPS |"
    ].join("\n");
    render(<MarkdownContent content={source} />);

    const table = await screen.findByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "歌曲" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "歌手" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "STYX HELIX" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "RADWIMPS" })).toBeInTheDocument();
    // 若 remark-gfm 被自定义插件整表顶掉，表格会退化成带竖线的纯文本段落
    expect(screen.queryByText(/\| 歌曲 \| 歌手 \|/)).not.toBeInTheDocument();
  });
});
