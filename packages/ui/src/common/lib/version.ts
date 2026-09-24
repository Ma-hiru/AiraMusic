import { RendererIPC } from "@mahiru/ipc/renderer";

export class RendererVersion {
  static readonly author = "Ma-hiru";
  static readonly authorPage = `https://github.com/${this.author}`;
  static readonly authorAvatar = `https://github.com/${this.author}.png?size=80`;
  static readonly appName = import.meta.env.APP_NAME;
  static readonly appVersion = import.meta.env.APP_VERSION;
  static readonly appDesc = import.meta.env.APP_DESC;
  static readonly homePage = `https://github.com/${this.author}/AiraMusic`;
  static openRepo = () => {
    RendererIPC.NormalChannel.send("event_window_browser", {
      url: this.homePage
    });
  };
  static openAuthor = () => {
    RendererIPC.NormalChannel.send("event_window_browser", {
      url: this.authorPage
    });
  };
}
