import { useRef, useState } from "react";

export function usePromiseResolvers<T = void>() {
  const [resolvers, setResolvers] = useState(() => Promise.withResolvers<T>());
  const [resolved, setResolved] = useState(false);
  const newResolver = useRef(() => {
    setResolved(false);
    setResolvers(Promise.withResolvers());
  });
  const resolveRef = useRef((value: T | PromiseLike<T>) => {
    setResolved(true);
    resolvers.resolve(value);
  });

  return {
    ...resolvers,
    resolved,
    resolve: resolveRef.current,
    newResolver: newResolver.current
  };
}
