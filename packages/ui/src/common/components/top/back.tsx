import { type FC, memo, useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath } from "@/common/routes";
import { useStableArray } from "@/common/hooks/use-stable-array";

import NoDrag from "@/common/components/drag/no-drag";

interface TopBackProps {
  className?: string;
  onClick?: NormalFunc;
  exclude?: string[];
  routePath?: RoutePath<any>;
}

const TopBack: FC<TopBackProps> = ({ className, onClick, exclude = [], routePath }) => {
  const [show, setShow] = useState(true);
  const stableExclude = useStableArray(exclude);
  const navigate = useNavigate();
  const location = useLocation();
  const click = useCallback(() => {
    onClick?.();
    navigate(-1);
  }, [navigate, onClick]);
  useEffect(() => {
    setShow(!stableExclude.some((path) => routePath?.match(location, path)));
  }, [location, routePath, stableExclude]);
  return (
    <NoDrag
      className={className}
      onClick={click}
      children={
        show && (
          <ArrowLeft className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300" />
        )
      }
    />
  );
};

export default memo(TopBack);
