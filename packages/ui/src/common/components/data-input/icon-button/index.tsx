import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import { memo, type FC, type ComponentProps, type ButtonHTMLAttributes } from "react";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  color?: string;
  show?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  size?: "normal" | "compact";
  variant?: "ghost" | "plain";
  iconProps?: Omit<ComponentProps<LucideIcon>, "className">;
}

const buttonSizeClass = {
  compact: "size-5",
  normal: "size-6"
} satisfies Record<NonNullable<IconButtonProps["size"]>, string>;

const iconSizeClass = {
  compact: "size-5",
  normal: "size-5.5"
} satisfies Record<NonNullable<IconButtonProps["size"]>, string>;

const variantClass = {
  ghost: "hover:bg-white/15 hover:text-white active:scale-95",
  plain: "hover:opacity-50 active:scale-95"
} satisfies Record<NonNullable<IconButtonProps["variant"]>, string>;

const IconButton: FC<IconButtonProps> = ({
  className,
  color,
  label,
  style,
  title,
  iconProps,
  icon: Icon,
  show = true,
  iconClassName,
  size = "normal",
  type = "button",
  variant = "ghost",
  ...props
}) => {
  if (!show) return null;
  return (
    <button
      className={cx(
        `
          inline-flex shrink-0 cursor-pointer items-center justify-center
          rounded-md outline-none transition-all duration-200 ease-in-out
          focus-visible:ring-2 focus-visible:ring-white/60
          disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35
        `,
        buttonSizeClass[size],
        variantClass[variant],
        className
      )}
      style={color ? { ...style, color } : style}
      type={type}
      aria-label={label}
      title={title ?? label}
      {...props}>
      <Icon {...iconProps} className={cx(iconSizeClass[size], iconClassName)} />
    </button>
  );
};

export default memo(IconButton);
