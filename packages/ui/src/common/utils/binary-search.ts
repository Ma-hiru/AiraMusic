export class BinarySearch {
  static search<T>(arr: T[], target: T, order?: NormalFunc<[a: T, b: T], "gt" | "lt" | "eq">) {
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

  static findFirstByMonotonicPredicate<T>(arr: T[], predicate: NormalFunc<[e: T], boolean>) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;
    let mid;

    while (left <= right) {
      mid = (left + right) >>> 1;
      if (predicate(arr[mid]!)) {
        result = mid;
        left = mid - 1;
      } else {
        right = mid + 1;
      }
    }

    return result;
  }
}
