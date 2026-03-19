import { FC, memo } from "react";
import { Loader } from "lucide-react";
import { motion, HTMLMotionProps } from "motion/react";

export type LoadingProps = HTMLMotionProps<"div">;

const Loading: FC<LoadingProps> = (props) => {
  return (
    <motion.div
      {...props}
      initial={{ transformOrigin: "center" }}
      animate={{
        rotate: 360,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
      <Loader />
    </motion.div>
  );
};

export default memo(Loading);
