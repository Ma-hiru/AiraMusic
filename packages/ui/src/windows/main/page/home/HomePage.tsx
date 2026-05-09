import { FC, memo } from "react";

import Content from "./Content";
import AppTitle from "@mahiru/ui/public/components/title/AppTitle";

const HomePage: FC<object> = () => {
  return (
    <div className="router-container">
      <AppTitle title="推荐" />
      <Content />
    </div>
  );
};

export default memo(HomePage);
