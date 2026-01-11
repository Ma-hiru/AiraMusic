import { FC, memo } from "react";

import Content from "./Content";
import Title from "@mahiru/ui/main/componets/Title";

const HomePage: FC<object> = () => {
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Title title="推荐" />
      <Content />
    </div>
  );
};

export default memo(HomePage);
