import { Loader } from "lucide-react";
import { memo, type FC, type HtmlHTMLAttributes } from "react";

export type LoadingProps = HtmlHTMLAttributes<HTMLDivElement>;

const Loading: FC<LoadingProps> = (props) => {
  return (
    <div {...props}>
      <Loader className="animate-spin" />
    </div>
  );
};

export default memo(Loading);
