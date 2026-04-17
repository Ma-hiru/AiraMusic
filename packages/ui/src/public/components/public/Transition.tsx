import { FC, memo, ReactNode } from "react";
import { AnimatePresence, HTMLElements, HTMLMotionProps, motion } from "motion/react";

type TransitionProps<T extends keyof HTMLElements> = HTMLMotionProps<T> & {
  asChild?: boolean;
  tag?: T;
  children: ReactNode;
  show: boolean;
};

const Transition = <T extends keyof HTMLElements>({
  transition,
  children,
  asChild,
  tag = "div" as T,
  show,
  ...props
}: TransitionProps<T>) => {
  if (asChild) return <AnimatePresence>{show && children}</AnimatePresence>;
  const Tag = motion[tag || "div"] as FC;
  return (
    <AnimatePresence>
      {show && (
        <Tag {...props} transition={transition || defaultTransition}>
          {children}
        </Tag>
      )}
    </AnimatePresence>
  );
};

export default memo(Transition);

const defaultTransition = {
  ease: "easeInOut",
  duration: 0.3
} as const;
