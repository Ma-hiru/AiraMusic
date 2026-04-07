import { FC, Suspense, ReactNode } from "react";

interface AppLoadingProps {
  children: ReactNode;
}

const AppLoading: FC<AppLoadingProps> = ({ children }) => {
  return <Suspense>{children}</Suspense>;
};

export default AppLoading;
