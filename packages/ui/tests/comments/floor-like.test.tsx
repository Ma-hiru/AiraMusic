import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { CommentType } from "@mahiru/ui/common/enum";
import Item from "@mahiru/ui/wins/comments/page/item";
import type { ComponentProps } from "react";
import type { NeteaseAPIComment } from "@mahiru/ui/common/netease/api";

type ParentComment = ComponentProps<typeof Item>["data"];
type FloorResponse = Awaited<ReturnType<typeof NeteaseAPIComment.floor>>;
type FloorComment = FloorResponse["data"]["comments"][number];

const mocks = vi.hoisted(() => ({ floor: vi.fn(), like: vi.fn(), toast: vi.fn() }));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIComment: { floor: mocks.floor, like: mocks.like }
}));
vi.mock("@/common/hooks/use-theme-color", () => ({
  useThemeColor: () => ({ mainColor: { string: () => "#ffffff" } })
}));
vi.mock("@/common/netease/models", () => ({
  NeteaseNetworkImage: { fromURL: () => null }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: mocks.toast } }));
vi.mock("@/common/components/display/image/netease-image", () => ({ default: () => null }));

let parentId = 1000;

function parent(): ParentComment {
  return {
    commentId: ++parentId,
    content: "父评论",
    time: Date.now(),
    liked: false,
    likedCount: 0,
    replyCount: 2,
    user: { nickname: "楼主", avatarUrl: "" }
  } as ParentComment;
}

function reply(owner: ParentComment, liked = false, index = 1) {
  return {
    commentId: owner.commentId * 10 + index,
    parentCommentId: owner.commentId,
    content: `回复 ${index}`,
    time: Date.now(),
    liked,
    likedCount: 5,
    owner: false,
    status: 0,
    beReplied: null,
    user: { nickname: `回复者 ${index}`, avatarUrl: "" } as FloorComment["user"]
  } satisfies FloorComment;
}

function page(comments: FloorComment[], hasMore = false, time = 0) {
  return {
    code: 200,
    message: "ok",
    data: {
      ownerComment: null,
      currentComment: null,
      comments,
      hasMore,
      totalCount: 2,
      time
    }
  } satisfies FloorResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function thumb(view: ReturnType<typeof render>, content = "回复 1") {
  return view.getByText(content).parentElement!.querySelector("svg")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.floor.mockReset();
  mocks.like.mockReset().mockResolvedValue({ code: 200 });
});
afterEach(cleanup);

it.each([false, true])(
  "preserves a reply's changed like state when reopening (liked=%s)",
  async (liked) => {
    const owner = parent();
    const floor = reply(owner, liked);
    mocks.floor.mockResolvedValueOnce(page([floor]));
    let view = render(<Item data={owner} type="track" sourceID={88} />);
    fireEvent.click(view.getByRole("button", { name: /条回复/ }));
    await view.findByText(floor.content);

    await act(async () => {
      fireEvent.click(thumb(view));
    });
    expect(thumb(view)).toHaveAttribute("fill", liked ? "transparent" : "currentColor");
    expect(mocks.like).toHaveBeenLastCalledWith({
      cid: floor.commentId,
      id: 88,
      t: liked ? 0 : 1,
      type: CommentType.Song
    });

    fireEvent.click(view.getByRole("button", { name: "收起" }));
    expect(view.queryByText(floor.content)).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: /条回复/ }));
    expect(thumb(view)).toHaveAttribute("fill", liked ? "transparent" : "currentColor");
    expect(mocks.floor).toHaveBeenCalledOnce();

    view.unmount();
    view = render(<Item data={owner} type="track" sourceID={88} />);
    fireEvent.click(view.getByRole("button", { name: /条回复/ }));
    expect(thumb(view)).toHaveAttribute("fill", liked ? "transparent" : "currentColor");
    expect(mocks.floor).toHaveBeenCalledOnce();

    await act(async () => {
      fireEvent.click(thumb(view));
    });
    expect(mocks.like).toHaveBeenLastCalledWith({
      cid: floor.commentId,
      id: 88,
      t: liked ? 1 : 0,
      type: CommentType.Song
    });
  }
);

it.each([false, true])(
  "rolls back a pending like across collapse and reopening (reopen first=%s)",
  async (reopenFirst) => {
    const owner = parent();
    const floor = reply(owner);
    const request = deferred<{ code: number }>();
    mocks.floor.mockResolvedValueOnce(page([floor]));
    mocks.like.mockReturnValueOnce(request.promise);
    const view = render(<Item data={owner} type="track" sourceID={88} />);
    fireEvent.click(view.getByRole("button", { name: /条回复/ }));
    await view.findByText(floor.content);
    fireEvent.click(thumb(view));
    expect(thumb(view)).toHaveAttribute("fill", "currentColor");
    fireEvent.click(view.getByRole("button", { name: "收起" }));

    if (reopenFirst) {
      fireEvent.click(view.getByRole("button", { name: /条回复/ }));
      expect(thumb(view)).toHaveAttribute("fill", "currentColor");
    }
    await act(async () => request.reject(new Error("offline")));
    if (!reopenFirst) fireEvent.click(view.getByRole("button", { name: /条回复/ }));

    expect(thumb(view)).toHaveAttribute("fill", "transparent");
    expect(mocks.toast).toHaveBeenLastCalledWith({ type: "error", text: "操作失败" });
    expect(mocks.floor).toHaveBeenCalledOnce();
  }
);

it("retains a like made while another page of replies is loading", async () => {
  const owner = parent();
  const first = reply(owner);
  const second = reply(owner, false, 2);
  const nextPage = deferred<ReturnType<typeof page>>();
  mocks.floor.mockResolvedValueOnce(page([first], true, 321)).mockReturnValueOnce(nextPage.promise);
  const view = render(<Item data={owner} type="track" sourceID={88} />);
  fireEvent.click(view.getByRole("button", { name: /条回复/ }));
  await view.findByText(first.content);
  fireEvent.click(view.getByRole("button", { name: /展开更多回复/ }));
  await waitFor(() => expect(mocks.floor).toHaveBeenCalledTimes(2));
  await act(async () => {
    fireEvent.click(thumb(view));
  });

  await act(async () => nextPage.resolve(page([second], false, 999)));
  expect(view.getByText(second.content)).toBeInTheDocument();
  expect(thumb(view)).toHaveAttribute("fill", "currentColor");
  expect(mocks.floor.mock.calls[1]![0]).toMatchObject({
    parentCommentId: owner.commentId,
    time: 321
  });

  fireEvent.click(view.getByRole("button", { name: "收起" }));
  fireEvent.click(view.getByRole("button", { name: /条回复/ }));
  expect(thumb(view)).toHaveAttribute("fill", "currentColor");
  expect(view.getByText(second.content)).toBeInTheDocument();
  expect(mocks.floor).toHaveBeenCalledTimes(2);
});
