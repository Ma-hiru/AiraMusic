import { type FC, type HtmlHTMLAttributes, memo } from "react";
import { Loader } from "lucide-react";

export type LoadingProps = HtmlHTMLAttributes<HTMLDivElement>;

const Loading: FC<LoadingProps> = (props) => {
  return (
    <div {...props}>
      <Loader className="animate-spin" />
    </div>
  );
};

export default memo(Loading);
