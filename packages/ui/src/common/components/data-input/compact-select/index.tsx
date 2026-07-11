import { cx } from "@emotion/css";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect, type ReactNode } from "react";

export interface CompactSelectOption {
  value: string;
  title?: string;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}

interface CompactSelectProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
  disabled?: boolean;
  onOpen?: () => void;
  placeholder: string;
  placement?: "top" | "bottom";
  options: CompactSelectOption[];
  renderFooter?: (close: () => void) => ReactNode;
  onChange: NormalFunc<[value: string]>;
}

const CompactSelect: FC<CompactSelectProps> = ({
  className,
  onOpen,
  onChange,
  label,
  value,
  options,
  disabled,
  icon: Icon,
  placeholder,
  renderFooter,
  placement = "bottom"
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeByEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeByEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) onOpen?.();
    setOpen(!open);
  };

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={cx("relative min-w-0", className)}>
      <button
        className="
          flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-lg
          border border-white/12 bg-white/8 px-2.5 text-left text-[12px] font-semibold
          text-white/72 outline-none transition-colors duration-200 hover:bg-white/12
          focus-visible:ring-2 focus-visible:ring-white/45 disabled:pointer-events-none
          disabled:cursor-not-allowed disabled:opacity-45
        "
        type="button"
        aria-label={label}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selected?.title ?? (typeof selected?.label === "string" ? selected.label : label)}
        onClick={toggleOpen}>
        {Icon && <Icon className="size-3.5 shrink-0 text-white/48" />}
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cx(
            "size-3.5 shrink-0 text-white/45 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cx(
            `
              absolute z-50 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl
              border border-white/14 bg-black/75 p-1.5 shadow-2xl shadow-black/35
              backdrop-blur-2xl backdrop-saturate-150
            `,
            placement === "top"
              ? "bottom-[calc(100%+0.5rem)] left-0"
              : "top-[calc(100%+0.5rem)] left-0"
          )}
          role="listbox"
          aria-label={label}>
          {options.length ? (
            options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  className={cx(
                    `
                      flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2
                      text-left outline-none transition-colors duration-200
                      focus-visible:ring-2 focus-visible:ring-white/45
                      disabled:pointer-events-none disabled:opacity-40
                    `,
                    active ? "bg-primary/80 text-primary-text" : "text-white/72 hover:bg-white/10"
                  )}
                  role="option"
                  type="button"
                  title={option.title}
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-[11px] opacity-55">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="size-4 shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-[12px] text-white/45">暂无可选项</div>
          )}
          {renderFooter && (
            <div className={cx(options.length > 0 && "mt-1 border-t border-white/10 pt-1")}>
              {renderFooter(close)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(CompactSelect);
