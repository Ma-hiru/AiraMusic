interface ZustandSet<T> {
  (updater: (draft: T) => (void | T)): void;
}

interface ZustandGet<T> {
  (): T;
}

interface ZustandConfig<T, U = T> {
  //with immer,we can use void value in set
  (set: ZustandSet<U>, get: ZustandGet<T>, api: any): T;
}
