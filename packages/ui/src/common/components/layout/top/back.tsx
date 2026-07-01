import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useState, useEffect, useCallback } from "react";
import { RoutePath } from "@/common/routes";
import { useStableArray } from "@/common/hooks/use-stable-array";

import NoDrag from "../drag/no-drag";

interface TopBackProps<R extends RoutePath<any>> {
  routePath?: R;
  className?: string;
  exclude?: (keyof R)[];
  onClick?: NormalFunc;
}

const TopBack = <R extends RoutePath<any>>({
  className,
  onClick,
  routePath,
  exclude = []
}: TopBackProps<R>) => {
  const [show, setShow] = useState(true);
  const stableExclude = useStableArray(exclude);
  const navigate = useNavigate();
  const location = useLocation();
  const click = useCallback(() => {
    onClick?.();
    navigate(-1);
  }, [navigate, onClick]);
  useEffect(() => {
    setShow(
      !stableExclude.some((page) => routePath?.matchPathname(location, routePath[page] as string))
    );
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

export default memo(TopBack) as typeof TopBack;
