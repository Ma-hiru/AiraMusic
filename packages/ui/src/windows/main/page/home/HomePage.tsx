import { FC, memo } from "react";

import Content from "./Content";
import Title from "@mahiru/ui/windows/main/componets/Title";

const HomePage: FC<object> = () => {
  return (
    <div className="router-container">
      <Title title="推荐" />
      <Content />
    </div>
  );
};

export default memo(HomePage);
