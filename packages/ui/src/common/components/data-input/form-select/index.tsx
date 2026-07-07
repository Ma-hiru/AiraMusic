import { cx } from "@emotion/css";
import { Check, ChevronDown } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect, type ReactNode } from "react";

export interface FormSelectOption {
  value: string;
  title?: string;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}

interface FormSelectProps {
  label: string;
  value: string;
  className?: string;
  disabled?: boolean;
  placeholder: string;
  options: FormSelectOption[];
  placement?: "top" | "bottom";
  onChange: NormalFunc<[value: string]>;
}

const FormSelect: FC<FormSelectProps> = ({
  className,
  onChange,
  label,
  value,
  options,
  disabled,
  placeholder,
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

  return (
    <div ref={rootRef} className={cx("relative min-w-0", className)}>
      <button
        className="
          flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border
          border-white/15 bg-white/10 px-3 text-left text-[13px] font-semibold
          text-white/72 outline-none transition-colors duration-200 hover:bg-white/14
          focus:border-primary focus:bg-white/15 focus-visible:ring-2
          focus-visible:ring-primary/40 disabled:pointer-events-none
          disabled:cursor-not-allowed disabled:opacity-45
        "
        type="button"
        aria-label={label}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selected?.title ?? (typeof selected?.label === "string" ? selected.label : label)}
        onClick={() => setOpen((current) => !current)}>
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cx(
            "size-4 shrink-0 text-white/45 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cx(
            `
              absolute z-80 w-full min-w-48 overflow-hidden rounded-lg border
              border-white/14 bg-black/80 p-1 shadow-2xl shadow-black/35
              backdrop-blur-2xl backdrop-saturate-150
            `,
            placement === "top"
              ? "bottom-[calc(100%+0.35rem)] left-0"
              : "top-[calc(100%+0.35rem)] left-0"
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
                      flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2
                      text-left outline-none transition-colors duration-200
                      focus-visible:ring-2 focus-visible:ring-white/45
                      disabled:pointer-events-none disabled:opacity-40
                    `,
                    active ? "bg-primary/85 text-primary-text" : "text-white/74 hover:bg-white/10"
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
                    <span className="block truncate text-[13px] font-semibold">{option.label}</span>
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
            <div className="px-2.5 py-2 text-[12px] text-white/45">暂无可选项</div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(FormSelect);
