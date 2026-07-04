type WindowType =
  | "main"
  | "tray"
  | "agent"
  | "image"
  | "login"
  | "lyric"
  | "display"
  | "comments"
  | "external"
  | "miniplayer"
  | WindowTypeAll
  | WindowTypeProcess;

type WindowTypeAll = "all";

type WindowTypeProcess = "process";

type WindowTypeWithoutAll = Exclude<WindowType, WindowTypeAll>;

type WindowBrowserType = Exclude<WindowType, WindowTypeAll | WindowTypeProcess>;
