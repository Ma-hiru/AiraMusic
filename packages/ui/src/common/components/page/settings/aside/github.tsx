import { siGithub } from "simple-icons";
import { memo, type FC, useState } from "react";
import { UserRound, ExternalLink } from "lucide-react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import Card from "@/common/components/layout/card";
import SimpleIcon from "@/common/components/display/simple-icon";

const author = "Ma-hiru";
const authorPage = `https://github.com/${author}`;
const authorAvatar = `https://github.com/${author}.png?size=80`;

const Github: FC<object> = () => {
  const [avatarOk, setAvatarOk] = useState(true);
  const openAuthor = () => {
    RendererIPC.NormalChannel.send("event_window_browser", {
      url: authorPage
    });
  };

  return (
    <Card title="作者" Icon={UserRound} subTitle="author">
      <section className="flex items-center justify-center gap-3">
        {avatarOk ? (
          <img
            className="size-12 shrink-0 rounded-full border border-white/30 object-cover"
            alt={author}
            src={authorAvatar}
            onError={() => setAvatarOk(false)}
          />
        ) : (
          <span
            className="
              flex size-12 shrink-0 items-center justify-center rounded-full border border-white/30
            ">
            <SimpleIcon className="size-5" icon={siGithub} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{author}</h1>
          <p className="mt-0.5 truncate text-[12px] opacity-50">项目作者 · Developer</p>
        </div>
      </section>
      <button
        className={`
          mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md
          border border-white/30 text-[12px] font-bold
          transition-all duration-300 hover:border-primary/40
          hover:bg-primary hover:text-primary-text
          active:scale-[0.98] cursor-pointer
        `}
        type="button"
        title="访问作者 GitHub 主页"
        onClick={openAuthor}>
        <SimpleIcon className="size-3.5" icon={siGithub} />
        <span>个人主页</span>
        <ExternalLink className="size-3.5 opacity-60" />
      </button>
    </Card>
  );
};

export default memo(Github);
