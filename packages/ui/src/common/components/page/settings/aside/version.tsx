import { type FC, memo } from "react";
import { siGithub } from "simple-icons";
import { ExternalLink, Info } from "lucide-react";
import { RendererIPC } from "@mahiru/ipc/renderer";

import Card from "@/common/components/layout/card";
import SimpleIcon from "@/common/components/display/simple-icon";

const appName = import.meta.env.APP_NAME;
const appVersion = import.meta.env.APP_VERSION;
const appDesc = import.meta.env.APP_DESC;
const author = "Ma-hiru";
const homePage = `https://github.com/${author}/AiraMusic`;

const Version: FC<object> = () => {
  const openRepo = () => {
    RendererIPC.NormalChannel.send("event_window_browser", {
      url: homePage
    });
  };
  return (
    <Card title="版本" subTitle="version" Icon={Info}>
      <section className="flex items-center justify-center gap-3">
        <img
          src="/images/logo.svg"
          alt={appName}
          className="size-12 shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
        />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black">{appName}</h1>
          <span
            className="
              mt-1 inline-block rounded-sm border border-white/30 px-1.5
              text-[11px] font-black tracking-wide
            ">
            {appVersion}
          </span>
        </div>
      </section>
      <p className="mt-4 line-clamp-2 text-[12px] leading-5 opacity-50 text-center">{appDesc}</p>
      <button
        type="button"
        title="在浏览器中打开开源仓库"
        onClick={openRepo}
        className={`
          mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md
          border border-white/30 text-[12px] font-bold
          transition-all duration-300 hover:border-(--theme-color-main)/40
          hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
          active:scale-[0.98] cursor-pointer
        `}>
        <SimpleIcon icon={siGithub} className="size-3.5" />
        <span>开源仓库</span>
        <ExternalLink className="size-3.5 opacity-60" />
      </button>
    </Card>
  );
};

export default memo(Version);
