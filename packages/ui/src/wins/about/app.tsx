import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import Drag from "@/common/components/layout/drag/drag";
import NoDrag from "@/common/components/layout/drag/no-drag";
import Background from "@/wins/display/pages/layout/background";
import Version from "@/common/components/page/settings/aside/version";
import type { FC } from "react";

export const About: FC = () => {
  useAppLoaded();
  return (
    <div className="w-screen h-screen overflow-hidden px-2 overflow-y-auto p-8 flex justify-center items-center">
      <Drag className="w-screen h-8 fixed left-0 top-0 z-10" />
      <Background />
      <NoDrag children={<Version />} />
    </div>
  );
};
