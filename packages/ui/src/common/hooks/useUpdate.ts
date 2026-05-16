import { useRef, useState } from "react";

interface Update {
  (): void;
  count: number;
}

export function useUpdate(): Update {
  const [count, setCount] = useState(0);

  const update = <Update>useRef(() => setCount((c) => c + 1)).current;
  update.count = count;

  return update;
}
