type WindowType =
  | "main"
  | "tray"
  | "agent"
  | "image"
  | "login"
  | "lyric"
  | "radio"
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
