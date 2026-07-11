import { useMediaQuery } from "@/common/hooks/use-media-query";

type TailwindBreakpoint = "lg" | "md" | "sm" | "xl" | "2xl";

/** 获取断点值 */
const getTailwindBreakpointValue = (name: TailwindBreakpoint): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--breakpoint-${name}`)
    .trim();

  if (!value) {
    throw new Error(`Missing Tailwind breakpoint: --breakpoint-${name}`);
  }

  return value;
};

/** 等价于 Tailwind 的 sm: / md: / lg: */
const getTailwindMediaQuery = (name: TailwindBreakpoint): string => {
  const value = getTailwindBreakpointValue(name);
  return `(width >= ${value})`;
};

/** 等价于 Tailwind 的 max-sm: / max-md: */
const getTailwindMaxMediaQuery = (name: TailwindBreakpoint): string => {
  const value = getTailwindBreakpointValue(name);
  return `(width < ${value})`;
};

/** 查询 Tailwind 的 sm: / md: / lg: */
function useTailwindMediaQuery() {
  const sm = useMediaQuery(getTailwindMediaQuery("sm"));
  const md = useMediaQuery(getTailwindMediaQuery("md"));
  const lg = useMediaQuery(getTailwindMediaQuery("lg"));
  const xl = useMediaQuery(getTailwindMediaQuery("xl"));
  const xxl = useMediaQuery(getTailwindMediaQuery("2xl"));

  const current = xxl ? "2xl" : xl ? "xl" : lg ? "lg" : md ? "md" : sm ? "sm" : "base";

  return {
    sm,
    md,
    lg,
    xl,
    "2xl": xxl,
    current
  } as const;
}

/** 查询 Tailwind 的 max-sm: / max-md: */
function useTailwindMaxMediaQuery() {
  const maxSm = useMediaQuery(getTailwindMaxMediaQuery("sm"));
  const maxMd = useMediaQuery(getTailwindMaxMediaQuery("md"));
  const maxLg = useMediaQuery(getTailwindMaxMediaQuery("lg"));
  const maxXl = useMediaQuery(getTailwindMaxMediaQuery("xl"));
  const max2xl = useMediaQuery(getTailwindMaxMediaQuery("2xl"));

  // prettier-ignore
  const current = max2xl ? "2xl" : maxXl ? "xl" : maxLg ? "lg" : maxMd ? "md" : maxSm ? "sm" : "base";

  return {
    maxSm,
    maxMd,
    maxLg,
    maxXl,
    max2xl,
    current
  } as const;
}

export {
  getTailwindMediaQuery,
  useTailwindMediaQuery,
  getTailwindMaxMediaQuery,
  useTailwindMaxMediaQuery,
  getTailwindBreakpointValue
};
