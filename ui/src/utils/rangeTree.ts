export type Range = [start: number, end: number]; // end 不含

export class RangeTree {
  ranges: Range[] = [];

  add(range: Range) {
    const result: Range[] = [];
    let [start, end] = range;

    for (const [s, e] of this.ranges) {
      if (e < start) {
        result.push([s, e]);
      } else if (end < s) {
        result.push([start, end]);
        start = s;
        end = e;
      } else {
        start = Math.min(start, s);
        end = Math.max(end, e);
      }
    }

    result.push([start, end]);
    result.sort((a, b) => a[0] - b[0]);
    this.ranges = result;
  }

  /** 返回缺失区间 */
  diff([start, end]: Range): Range[] {
    const missing: Range[] = [];
    let cur = start;

    for (const [s, e] of this.ranges) {
      if (e < cur) continue;
      if (s > cur) missing.push([cur, Math.min(end, s)]);
      if (e >= end) return missing;
      cur = e;
    }

    if (cur < end) missing.push([cur, end]);
    return missing;
  }
}
