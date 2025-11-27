import { FC, memo } from "react";
import { Loader, LoaderCircle } from "lucide-react";
import { motion, HTMLMotionProps } from "motion/react";

export type LoadingProps = HTMLMotionProps<"div">;

const Loading: FC<LoadingProps> = (props) => {
  return (
    <motion.div
      {...props}
      animate={{
        rotate: 360,
        transformOrigin: "50% 50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 32,
        minHeight: 32
      }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
      <Loader />
    </motion.div>
  );
};
export default memo(Loading);
