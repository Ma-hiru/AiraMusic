import { memo, type FC, type SVGProps } from "react";
import type { SimpleIcon } from "simple-icons";

interface SimpleIconProps extends SVGProps<SVGSVGElement> {
  title?: string;
  icon: SimpleIcon;
}

const SimpleIcon: FC<SimpleIconProps> = ({ className, icon, title = icon.title, ...props }) => {
  return (
    <svg
      className={className}
      role="img"
      aria-label={title}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}>
      <title>{title}</title>
      <path d={icon.path} />
    </svg>
  );
};

export default memo(SimpleIcon);
