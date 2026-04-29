import { Listenable } from "@mahiru/ui/public/utils/listenable";
import _AppWindow from "@mahiru/ui/public/source/electron/services/window";

class AppPlayerBus extends Listenable {
  data: Nullable<MessageTypeMap["playerBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("playerBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"playerBus">["data"]) {
    _AppWindow.all.send("playerBus", data);
  }
}

class AppProgressBus extends Listenable {
  data: Nullable<MessageTypeMap["progressBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("progressBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"progressBus">["data"]) {
    _AppWindow.all.send("progressBus", data);
  }
}

class AppInfoBus extends Listenable {
  data: Nullable<MessageTypeMap["infoBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("infoBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"infoBus">["data"]) {
    _AppWindow.all.send("infoBus", data);
  }
}

class AppCommentsBus extends Listenable {
  data: Nullable<MessageTypeMap["commentBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("commentBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"commentBus">["data"]) {
    _AppWindow.from("comments").send("commentBus", data);
  }

  commit(data: MessageTypeMap["commentBus"]) {
    this.data = data;
    this.executeListeners();
  }
}

class AppPlayerActionBus extends Listenable {
  data: MessageTypeMap["playerActionBus"][] = [];

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("playerActionBus", ({ data }) => {
      console.log("playerActionBus", data);
      this.data = [...this.data, data];
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"playerActionBus">["data"]) {
    _AppWindow.main.send("playerActionBus", data);
  }

  finish() {
    this.data = [];
  }
}

class AppUpdateMainBus extends Listenable {
  data: MessageTypeMap["updateBus"][] = [];

  constructor() {
    super();
    _AppWindow.all.listenMessageAll("updateBus", ({ data }) => {
      this.data = [...this.data, data];
      this.executeListeners();
    });
  }

  send(data: MessageDataSend<"updateBus">["data"]) {
    _AppWindow.all.send("updateBus", data);
  }

  finish() {
    this.data = [];
  }
}

export default class _AppBus {
  private static playerBus = new AppPlayerBus();
  private static progressBus = new AppProgressBus();
  private static infoBus = new AppInfoBus();
  private static commentBus = new AppCommentsBus();
  private static playerActionBus = new AppPlayerActionBus();
  private static updateMainBus = new AppUpdateMainBus();

  static get player() {
    return _AppBus.playerBus;
  }

  static get progress() {
    return _AppBus.progressBus;
  }

  static get info() {
    return _AppBus.infoBus;
  }

  static get comment() {
    return _AppBus.commentBus;
  }

  static get mainBusUpdater() {
    return _AppBus.updateMainBus;
  }

  static get playerAction() {
    return _AppBus.playerActionBus;
  }
}
