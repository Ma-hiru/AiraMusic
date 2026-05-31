import { type FC, memo, useCallback, useState } from "react";
import { CalendarDays, LoaderCircle, Play, Radio, type LucideIcon } from "lucide-react";
import { NeteaseAPITrack } from "@/common/netease/api";
import { Log } from "@/common/lib/log";
import AppToast from "@/common/components/toast";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { useUser } from "@/common/store/user";
import AppEntry from "@/wins/main/entry";
import { createHomeTrackRecord } from "./home-track-record";

type ActionKey = "daily" | "fm";

interface HomeActionButtonProps {
  icon: LucideIcon;
  title: string;
  subTitle: string;
  loading: boolean;
  onClick: NormalFunc;
}

const HomeActionButton: FC<HomeActionButtonProps> = ({
  icon: Icon,
  title,
  subTitle,
  loading,
  onClick
}) => {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="
        group flex min-h-24 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg
        border border-white/20 bg-white/5 p-3 text-left shadow-md backdrop-blur-2xl
        transition-all duration-300 ease-in-out hover:bg-(--theme-color-main)
        hover:text-(--text-color-on-main) active:scale-[0.98] disabled:cursor-wait
      ">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
        {loading ? <LoaderCircle className="size-5 animate-spin" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{title}</span>
        <span className="mt-1 block line-clamp-2 text-[11px] font-semibold opacity-65">
          {subTitle}
        </span>
      </span>
      <Play className="ml-auto size-4 shrink-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </button>
  );
};

const ForYouPanel: FC<object> = () => {
  const user = useUser();
  const player = AppEntry.usePlayer();
  const [loading, setLoading] = useState<Nullable<ActionKey>>(null);

  const ensureLogin = useCallback(() => {
    if (user?.isLoggedIn) return true;
    AppToast.show({
      type: "info",
      text: "请先登录网易云账号"
    });
    return false;
  }, [user?.isLoggedIn]);

  const playDailyTracks = useCallback(async () => {
    if (!ensureLogin() || loading) return;
    setLoading("daily");
    try {
      const response = await NeteaseAPITrack.recommendDaily();
      const ids = response.data.dailySongs.map((song) => song.id);
      const tracks = await NeteaseServicesTrack.ids(ids);
      const records = tracks.map(createHomeTrackRecord);
      if (!records.length) {
        AppToast.show({ type: "info", text: "今日推荐暂时为空" });
        return;
      }
      player.playlist.replace(records, records[0]!);
    } catch (error) {
      Log.info("ForYouPanel", error);
      AppToast.show({ type: "error", text: "播放每日推荐失败" });
    } finally {
      setLoading(null);
    }
  }, [ensureLogin, loading, player.playlist]);

  const playPersonalFM = useCallback(async () => {
    if (!ensureLogin() || loading) return;
    setLoading("fm");
    try {
      const response = await NeteaseAPITrack.personalFM();
      const trackID = response.data[0]?.id;
      if (!trackID) {
        AppToast.show({ type: "info", text: "私人 FM 暂时没有推荐" });
        return;
      }
      const record = createHomeTrackRecord(await NeteaseServicesTrack.idEnsure(trackID));
      player.playlist.add(record, "next");
      player.playlist.jump(record);
    } catch (error) {
      Log.info("ForYouPanel", error);
      AppToast.show({ type: "error", text: "启动私人 FM 失败" });
    } finally {
      setLoading(null);
    }
  }, [ensureLogin, loading, player.playlist]);

  return (
    <aside
      className="
        flex h-full min-h-56 flex-col justify-between gap-3 rounded-lg border border-white/20
        bg-white/5 p-3 text-(--text-color-on-main) shadow-md backdrop-blur-2xl
      ">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">For You</p>
        <h2 className="mt-1 truncate text-2xl font-black">
          {user?.isLoggedIn ? user.profile.nickname : "发现音乐"}
        </h2>
        <p className="mt-2 line-clamp-2 text-xs font-semibold opacity-60">
          {user?.isLoggedIn ? "今日推荐和私人 FM 已就绪" : "推荐歌单、排行榜和新碟可直接浏览"}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <HomeActionButton
          icon={CalendarDays}
          title="每日推荐"
          subTitle="替换当前播放队列"
          loading={loading === "daily"}
          onClick={playDailyTracks}
        />
        <HomeActionButton
          icon={Radio}
          title="私人 FM"
          subTitle="播放一首私人电台推荐"
          loading={loading === "fm"}
          onClick={playPersonalFM}
        />
      </div>
    </aside>
  );
};

export default memo(ForYouPanel);
