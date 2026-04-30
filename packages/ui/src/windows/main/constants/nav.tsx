import { Clock, Heart, House } from "lucide-react";
import { ReactNode } from "react";
import { RoutePathMain } from "@mahiru/ui/public/routes";

export type NavData = {
  icon: ReactNode;
  label: string;
  path: string;
};

export class NavConstants {
  static readonly navs: NavData[] = [
    {
      icon: <House className="w-full aspect-square" />,
      label: "推荐",
      path: RoutePathMain.home
    },
    {
      icon: <Heart className="w-full aspect-square" />,
      label: "喜欢",
      path: RoutePathMain.playlist.like
    },
    {
      icon: <Clock className="w-full aspect-square" />,
      label: "历史",
      path: RoutePathMain.playlist.history
    }
  ];
}
