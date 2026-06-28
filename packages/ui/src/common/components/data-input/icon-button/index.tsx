import { cx } from "@emotion/css";
import { type ButtonHTMLAttributes, type ComponentProps, type FC, memo } from "react";
import { type LucideIcon } from "lucide-react";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
  color?: string;
  iconClassName?: string;
  iconProps?: Omit<ComponentProps<LucideIcon>, "className">;
  size?: "compact" | "normal";
  variant?: "ghost" | "plain";
}

const buttonSizeClass = {
  compact: "size-5",
  normal: "size-7"
} satisfies Record<NonNullable<IconButtonProps["size"]>, string>;

const iconSizeClass = {
  compact: "size-5",
  normal: "size-4.5"
} satisfies Record<NonNullable<IconButtonProps["size"]>, string>;

const variantClass = {
  ghost: "hover:bg-white/15 hover:text-white active:scale-95",
  plain: "hover:opacity-50 active:scale-95"
} satisfies Record<NonNullable<IconButtonProps["variant"]>, string>;

const IconButton: FC<IconButtonProps> = ({
  icon: Icon,
  label,
  color,
  className,
  iconClassName,
  iconProps,
  size = "normal",
  variant = "ghost",
  title,
  type = "button",
  style,
  ...props
}) => {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      style={color ? { ...style, color } : style}
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
      {...props}>
      <Icon {...iconProps} className={cx(iconSizeClass[size], iconClassName)} />
    </button>
  );
};

export default memo(IconButton);
