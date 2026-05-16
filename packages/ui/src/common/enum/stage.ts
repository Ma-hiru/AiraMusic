export class Stage {
  private readonly value: number;
  private constructor(value: number) {
    this.value = value;
  }

  static readonly Immediately = new Stage(0);
  static readonly First = new Stage(1);
  static readonly Second = new Stage(2);
  static readonly Finally = new Stage(3);

  [Symbol.toPrimitive](hint: string) {
    if (hint === "number") {
      return this.value;
    } else if (hint === "string") {
      switch (this.value) {
        case 0:
          return "Stage(Immediately)";
        case 1:
          return "Stage(First)";
        case 2:
          return "Stage(Second)";
        case 3:
          return "Stage(Finally)";
        default:
          return "Stage(Unknown)";
      }
    } else {
      return this.value;
    }
  }
}
