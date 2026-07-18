import { cx } from "@emotion/css";
import { createPortal } from "react-dom";
import { Plus, Check, Pencil, RefreshCw, ChevronDown, type LucideIcon } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback, type CSSProperties } from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import type { AIProviderConfigSnapshot } from "@mahiru/ai";

interface ConfigPickerProps {
  loading?: boolean;
  disabled?: boolean;
  selectedConfigID: string;
  configs: AIProviderConfigSnapshot[];
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onCreate: NormalFunc;
  onRefresh: NormalFunc;
  onSelect: NormalFunc<[id: string]>;
  onEdit: NormalFunc<[config: AIProviderConfigSnapshot]>;
}

const PopoverWidth = 304;

const ConfigPicker: FC<ConfigPickerProps> = ({
  onEdit,
  onCreate,
  onSelect,
  onRefresh,
  configs,
  loading,
  disabled,
  activeConfig,
  selectedConfigID
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  useScrollAutoHide(listRef, 700, !open);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PopoverWidth, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12)
    );
    setPosition({
      top: rect.bottom + 7,
      left,
      width
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    onRefresh();

    const closeFromOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("mousedown", closeFromOutside);
    window.addEventListener("keydown", closeFromKeyboard);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("mousedown", closeFromOutside);
      window.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [onRefresh, open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        className="flex h-8 max-w-64 cursor-pointer items-center gap-2 rounded-lg border border-white/8 bg-white/[0.035] px-2.5 text-left outline-none transition-colors hover:bg-white/7 focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-45"
        type="button"
        aria-label="模型配置"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}>
        <span
          className={cx(
            "size-1.5 shrink-0 rounded-full",
            activeConfig ? "bg-emerald-300/72" : "bg-white/25"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-medium text-white/65">
            {activeConfig?.name ?? "选择模型"}
          </span>
          {activeConfig && (
            <span className="mt-px block truncate text-[8px] text-white/25">
              {activeConfig.config.model}
            </span>
          )}
        </span>
        <ChevronDown
          className={cx("size-3 shrink-0 text-white/30 transition-transform", open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-100 overflow-hidden rounded-xl border border-white/10 bg-[#111216]/97 p-1.5 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl"
            style={position}
            role="dialog"
            aria-label="选择模型配置">
            <header className="flex h-9 items-center justify-between gap-2 px-2">
              <div>
                <div className="text-[11px] font-medium text-white/72">模型配置</div>
                <div className="mt-px text-[8px] text-white/28">切换不会影响当前对话记录</div>
              </div>
              <button
                className="grid size-7 cursor-pointer place-items-center rounded-lg text-white/35 outline-none hover:bg-white/7 hover:text-white/65 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-35"
                title="刷新配置"
                type="button"
                aria-label="刷新配置"
                disabled={loading}
                onClick={onRefresh}>
                <RefreshCw className={cx("size-3.5", loading && "animate-spin")} />
              </button>
            </header>

            <div
              ref={listRef}
              className="agent-scroll mt-1 max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {configs.map((config) => {
                const active = config.id === selectedConfigID;
                return (
                  <div
                    key={config.id}
                    className={cx(
                      "group relative flex min-h-11 items-center rounded-lg border",
                      active ? "border-white/9 bg-white/9" : "border-transparent hover:bg-white/5"
                    )}>
                    {active && (
                      <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <button
                      className="min-w-0 flex-1 cursor-pointer px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35"
                      type="button"
                      onClick={() => {
                        onSelect(config.id);
                        setOpen(false);
                      }}>
                      <span className="block truncate text-[11px] font-medium text-white/76">
                        {config.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-white/32">
                        {config.config.model} · {config.provider}
                      </span>
                    </button>
                    {active && <Check className="mr-1 size-3.5 shrink-0 text-primary" />}
                    <button
                      className="mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/30 opacity-45 outline-none transition-all hover:bg-white/8 hover:text-white/65 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/35 group-hover:opacity-100"
                      type="button"
                      title={`编辑 ${config.name}`}
                      aria-label={`编辑 ${config.name}`}
                      onClick={() => {
                        setOpen(false);
                        onEdit(config);
                      }}>
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                );
              })}
              {!configs.length && (
                <div className="px-2.5 py-5 text-center text-[10px] text-white/35">
                  暂无模型配置
                </div>
              )}
            </div>

            <div className="mt-1 border-t border-white/8 pt-1">
              <PickerAction
                icon={Plus}
                label="新增模型配置"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const PickerAction: FC<{ label: string; icon: LucideIcon; onClick: NormalFunc }> = ({
  onClick,
  label,
  icon: Icon
}) => (
  <button
    className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[10px] font-medium text-white/58 outline-none hover:bg-white/6 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/35"
    type="button"
    onClick={onClick}>
    <Icon className="size-3.5 text-white/35" />
    {label}
  </button>
);

export default memo(ConfigPicker);
