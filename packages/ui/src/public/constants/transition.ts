export const TransitionPreset = {
  OpacityPreset: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: 0.3,
      ease: "easeInOut"
    }
  }
} as const;
