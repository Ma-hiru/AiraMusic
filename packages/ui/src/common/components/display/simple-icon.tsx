import { type FC, memo, type SVGProps } from "react";
import type { SimpleIcon } from "simple-icons";

interface SimpleIconProps extends SVGProps<SVGSVGElement> {
  icon: SimpleIcon;
  title?: string;
}

const SimpleIcon: FC<SimpleIconProps> = ({ icon, title = icon.title, className, ...props }) => {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-label={title}
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}>
      <title>{title}</title>
      <path d={icon.path} />
    </svg>
  );
};

export default memo(SimpleIcon);
