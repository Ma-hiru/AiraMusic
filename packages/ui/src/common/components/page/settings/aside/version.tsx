import { siGithub } from "simple-icons";
import { memo, useRef, type FC, useState } from "react";
import { Info, Download, ExternalLink } from "lucide-react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererVersion } from "@/common/lib/version";
import Card from "@/common/components/layout/card";
import AppToast from "@/common/components/display/toast";
import AppContextMenu from "@/common/components/display/menu";
import SimpleIcon from "@/common/components/display/simple-icon";

const Version: FC<object> = () => {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const { create } = AppContextMenu.useMenu();

  const exportLogs = async (scope: "all" | "recent") => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const result = await RendererIPC.NormalChannel.send("invoke_log_export", scope);
      if (result.canceled) return;
      AppToast.show({
        type: result.ok ? "success" : "error",
        text: result.ok ? "日志已导出" : result.error || "日志导出失败"
      });
    } catch {
      AppToast.show({ type: "error", text: "日志导出失败" });
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

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
      <button
        className={`
          mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md
          border border-white/30 text-[12px] font-bold
          transition-all duration-300 enabled:hover:border-primary/40
          enabled:hover:bg-primary enabled:hover:text-primary-text
          enabled:active:scale-[0.98] cursor-pointer
          disabled:cursor-wait disabled:opacity-50
        `}
        type="button"
        disabled={exporting}
        title="导出最近 10 份或全部日志"
        onClick={(event) => {
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          create(() => ({
            clientX: bounds.left,
            clientY: bounds.bottom + 4,
            items: [
              { label: "最近 10 份日志", onClick: () => void exportLogs("recent") },
              { label: "全部日志", onClick: () => void exportLogs("all") }
            ]
          }));
        }}>
        <Download className="size-3.5" />
        <span>{exporting ? "导出中…" : "导出日志"}</span>
      </button>
    </Card>
  );
};

export default memo(Version);
