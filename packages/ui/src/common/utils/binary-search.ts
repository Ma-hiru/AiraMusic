export class BinarySearch {
  static search<T>(arr: T[], target: T, order?: NormalFunc<[a: T, b: T], "eq" | "gt" | "lt">) {
    order ??= (a, b) => {
      if (a < b) return "lt";
      if (a > b) return "gt";
      return "eq";
    };

    let left = 0;
    let right = arr.length - 1;
    let mid;
    while (left <= right) {
      mid = (left + right) >>> 1;
      if (order(arr[mid]!, target) === "eq") {
        return mid;
      } else if (order(arr[mid]!, target) === "lt") {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  /** TTTTFFFF */
  static findLastByMonotonicPredicate<T>(arr: T[], predicate: NormalFunc<[e: T], boolean>) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;
    let mid;

    while (left <= right) {
      mid = (left + right) >>> 1;
      if (predicate(arr[mid]!)) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  /** FFFFTTTT */
  static findFirstByMonotonicPredicate<T>(arr: T[], predicate: NormalFunc<[e: T], boolean>) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = (left + right) >>> 1;

      if (predicate(arr[mid]!)) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result;
  }
}
