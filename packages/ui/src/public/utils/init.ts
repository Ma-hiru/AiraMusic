import { Log } from "@mahiru/ui/public/utils/dev";
import _AppWindow from "@mahiru/ui/public/source/electron/services/window";

interface CanInit {
  _init: () => void;
}

type InitOptions =
  | {
      onError?: (e: unknown) => void;
    }
  | {
      panic: boolean;
      panicMessage: string;
      onError?: (e: unknown) => void;
    };

export default class Init {
  private static execute(obj: CanInit, options: InitOptions = {}) {
    try {
      obj._init();
    } catch (e) {
      Log.error({
        label: "init",
        message: "init error",
        raw: e
      });

      if (options.onError) options.onError(e);
      if ("panic" in options && options.panic)
        _AppWindow.panic(options.panicMessage ?? "init error");
    }
  }
  static initMicrotask(obj: CanInit, options: InitOptions = {}) {
    window.queueMicrotask(() => {
      this.execute(obj, options);
    });
  }

  static initNextIdle(obj: CanInit, options: InitOptions = {}) {
    window.requestIdleCallback(() => {
      this.execute(obj, options);
    });
  }

  static initNextFrame(obj: CanInit, options: InitOptions = {}) {
    window.requestAnimationFrame(() => {
      this.execute(obj, options);
    });
  }

  static initSync(obj: CanInit, options: InitOptions = {}) {
    this.execute(obj, options);
  }
}
