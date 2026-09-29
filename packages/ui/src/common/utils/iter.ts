function createIter(min: number, max: number) {
  return {
    [Symbol.iterator](): Iterator<number, number, void> {
      let current = min;
      return {
        next(): IteratorResult<number, number> {
          if (current >= max) {
            return {
              value: current,
              done: true
            };
          }
          return {
            value: current++,
            done: false
          };
        }
      };
    },
    map<T>(callback: (value: number, index: number) => T): T[] {
      const result: T[] = [];

      let index = 0;
      for (const value of this) {
        result.push(callback(value, index));
        index++;
      }

      return result;
    },
    forEach(callback: (value: number, index: number) => void): void {
      let index = 0;
      for (const value of this) {
        callback(value, index);
        index++;
      }
    }
  };
}

interface IterFunc {
  (min: number, max: number): ReturnType<typeof createIter>;
  (n: number): ReturnType<typeof createIter>;
}

export const iter: IterFunc = (...args: number[]) => {
  let min = 0;
  let max = 0;
  if (Number.isFinite(args[0]) && Number.isFinite(args[1])) {
    min = args[0]!;
    max = args[1]!;
  } else if (Number.isFinite(args[0])) {
    max = args[0]!;
  }
  return createIter(min, max);
};

export function zip<A, B>(a: Iterable<A>, b: Iterable<B>): Generator<[A, B]>;

export function zip<A, B>(
  a: Iterable<A>,
  b: Iterable<B>,
  mode: "longest"
): Generator<[A | undefined, B | undefined]>;

export function* zip<A, B>(
  a: Iterable<A>,
  b: Iterable<B>,
  mode?: "longest"
): Generator<[A | undefined, B | undefined]> {
  const a_iter = a[Symbol.iterator]();
  const b_iter = b[Symbol.iterator]();

  while (true) {
    const a_next = a_iter.next();
    const b_next = b_iter.next();

    if (mode === "longest") {
      if (a_next.done && b_next.done) return;
    } else {
      if (a_next.done || b_next.done) return;
    }

    yield [a_next.value, b_next.value];
  }
}
