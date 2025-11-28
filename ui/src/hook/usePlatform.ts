import { getPlatform } from "@mahiru/ui/utils/info";
import { useEffect, useState } from "react";

export function usePlatform() {
  const [platform, setPlatform] = useState<NodeJS.Platform | "unknown">("unknown");
  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);
  return platform;
}
