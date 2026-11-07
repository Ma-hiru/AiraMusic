import { z } from "zod";
import type { BrowserWindow } from "electron";
import type {
  MessageData,
  ForwardChecker,
  AgentAppContext,
  AgentFocusContext
} from "@mahiru/ipc/types";

/** 页面自己上报轻量标识；窗口身份与焦点由主进程确认。 */
export class MainAgentContext {
  private static readonly pages = new Map<ContextWindow, ContextEntry>();
  private static lastFocused?: ContextWindow;
  private static currentTrack: AgentAppContext["currentTrack"] = null;
  private static trackWindow?: BrowserWindow;
  private static unsubscribe?: NormalFunc;
  private static windows?: ContextWindows;

  static init(subscribe: (checker: ForwardChecker<any>) => NormalFunc, windows: ContextWindows) {
    this.windows = windows;
    this.unsubscribe ??= subscribe((window, message) => {
      const type = this.windows?.getId(window);
      if (message.type === "bus_deliver_track_meta" && type === "main") {
        const { track } = message.data as MessageData<"bus_deliver_track_meta">;
        this.trackWindow = window;
        this.currentTrack = track
          ? {
              id: track.id,
              name: track.name.slice(0, 512),
              artists: track.detail.ar.slice(0, 10).map((artist) => artist.name.slice(0, 128))
            }
          : null;
      }
      if (message.type !== "bus_deliver_focus_context") return true;
      if (type !== "main" && type !== "display" && type !== "comments") return false;
      const parsed = focusContextSchema.safeParse(message.data);
      if (!parsed.success) return false;
      this.update(type, window, parsed.data);
      return false;
    });
  }

  static snapshot(): AgentAppContext {
    const available = [...this.pages.entries()].filter(([type, entry]) => {
      const window = this.windows?.get(type);
      return window === entry.window && window.isVisible() && !window.isMinimized();
    });
    const focused = available.find(([, entry]) => entry.window.isFocused());
    if (focused) this.lastFocused = focused[0];
    const selected =
      focused ??
      available.find(([type]) => type === this.lastFocused) ??
      available.find(([type]) => type === "main") ??
      available[0];
    return structuredClone({
      window: selected?.[0] ?? null,
      page: selected?.[1].context ?? null,
      currentTrack: this.windows?.get("main") === this.trackWindow ? this.currentTrack : null
    });
  }

  private static update(type: ContextWindow, window: BrowserWindow, context: AgentFocusContext) {
    const previous = this.pages.get(type);
    if (context.page === "hidden" || previous?.window !== window) {
      previous?.window.removeListener("focus", previous.focus);
      this.pages.delete(type);
    }
    if (context.page === "hidden") return;
    let entry = this.pages.get(type);
    if (!entry) {
      const focus = () => {
        this.lastFocused = type;
      };
      window.on("focus", focus);
      entry = { window, context, focus };
      this.pages.set(type, entry);
    }
    entry.context = context;
    if (window.isFocused()) this.lastFocused = type;
  }

  static [Symbol.dispose]() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const { focus, window } of this.pages.values()) window.removeListener("focus", focus);
    this.pages.clear();
    this.currentTrack = null;
    this.trackWindow = undefined;
    this.lastFocused = undefined;
    this.windows = undefined;
  }
}

const contextText = z.string().transform((value) => value.slice(0, 512));

const focusContextSchema = z.discriminatedUnion("page", [
  z.object({ page: z.enum(["home", "hidden", "settings"]) }),
  z.object({ page: z.literal("search"), keyword: contextText }),
  z.object({
    page: z.enum(["album", "artist"]),
    id: z.number().int().positive(),
    name: contextText
  }),
  z.object({
    page: z.literal("playlist"),
    id: z.number().int().positive().nullable(),
    name: contextText.optional(),
    source: z.enum(["normal", "user-liked-track"])
  }),
  z.object({
    page: z.literal("comments"),
    id: z.number().int().positive(),
    type: z.enum(["album", "track", "playlist"])
  }),
  z.object({
    page: z.literal("history"),
    recent: z
      .array(
        z.object({
          id: z.number().int().positive(),
          name: contextText,
          time: contextText,
          playDuration: contextText
        })
      )
      .max(20)
  })
]);

type ContextWindow = NonNullable<AgentAppContext["window"]>;

type ContextEntry = {
  focus: () => void;
  window: BrowserWindow;
  context: AgentFocusContext;
};

type ContextWindows = {
  get(type: WindowType): null | BrowserWindow;
  getId(window: BrowserWindow): null | WindowType;
};
