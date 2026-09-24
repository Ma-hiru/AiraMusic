import { memo, type FC } from "react";
import { siGithub } from "simple-icons";
import { Info, ExternalLink } from "lucide-react";
import { RendererVersion } from "@/common/lib/version";
import Card from "@/common/components/layout/card";
import SimpleIcon from "@/common/components/display/simple-icon";

const Version: FC<object> = () => {
  return (
    <Card title="版本" Icon={Info} subTitle="version">
      <section className="flex items-center justify-center gap-3">
        <img
          className="size-12 shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          src="/images/logo.svg"
          alt={RendererVersion.appName}
        />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{RendererVersion.appName}</h1>
          <span
            className="
              mt-1 inline-block rounded-sm border border-white/30 px-1.5
              text-[11px] font-semibold tracking-wide
            ">
            {RendererVersion.appVersion}
          </span>
        </div>
      </section>
      <p className="mt-4 line-clamp-2 text-[12px] leading-5 opacity-50 text-center">
        {RendererVersion.appDesc}
      </p>
      <button
        className={`
          mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md
          border border-white/30 text-[12px] font-bold
          transition-all duration-300 hover:border-primary/40
          hover:bg-primary hover:text-primary-text
          active:scale-[0.98] cursor-pointer
        `}
        type="button"
        title="在浏览器中打开开源仓库"
        onClick={RendererVersion.openRepo}>
        <SimpleIcon className="size-3.5" icon={siGithub} />
        <span>开源仓库</span>
        <ExternalLink className="size-3.5 opacity-60" />
      </button>
    </Card>
  );
};

export default memo(Version);
