import { DevInfo } from "@mahiru/ui/utils/info";
import { useEffect, useState } from "react";

export function usePlatform() {
  const [platform, setPlatform] = useState<NodeJS.Platform | "unknown">("unknown");
  useEffect(() => {
    DevInfo.Platform.then(setPlatform);
  }, []);
  return platform;
}
