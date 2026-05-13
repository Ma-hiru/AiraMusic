type WindowType =
  | "main"
  | "login"
  | "lyric"
  | "miniplayer"
  | "external"
  | "display"
  | "tray"
  | "image"
  | "comments"
  | WindowTypeProcess
  | WindowTypeAll;

type WindowTypeAll = "all";

type WindowTypeProcess = "process";

type WindowTypeWithoutAll = Exclude<WindowType, WindowTypeAll>;

type WindowBrowserType = Exclude<WindowType, WindowTypeAll | WindowTypeProcess>;
