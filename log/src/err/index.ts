class EqErrorRaw {
  raw?: Error;
  label?: string;
  id?: number | string | symbol;
  message: string;
  private readonly isEqError: boolean;
  private readonly dev;
  constructor(
    props: { raw?: any; label?: string; message: string; id?: number | string | symbol },
    dev: boolean = false
  ) {
    this.dev = dev;
    const { raw, label, message, id } = props;
    const [err, isEqError] = EqErrorRaw.anyToError(raw);
    this.raw = err;
    this.isEqError = isEqError;
    this.label = label;
    this.message = message;
    this.id = id;
  }

  eq(other: EqErrorRaw, strict: boolean = false) {
    if (strict) {
      return (
        this.raw?.message === other.raw?.message &&
        this.message === other.message &&
        (this.id === other.id ||
          (typeof this.id === "undefined" && typeof other.id === "undefined"))
      );
    }
    if (typeof this.id !== "undefined" && typeof other.id !== "undefined") {
      return this.id === other.id;
    }
    return this.message === other.message;
  }

  toString() {
    if (this.label) {
      if (this.raw) {
        return `[${this.label}] ${this.message}: ${this.getRawMessage()}`;
      } else {
        return `[${this.label}] ${this.message}`;
      }
    } else {
      if (this.raw) {
        return `${this.message}: ${this.getRawMessage()}`;
      } else {
        return this.message;
      }
    }
  }

  print() {
    console.error(this.toString());
  }

  printDEV() {
    this.dev && console.error(this.toString());
  }

  printRELEASE() {
    !this.dev && console.error(this.toString());
  }

  private getRawMessage() {
    if (this.isEqError) {
      return "\n  " + this.raw?.message || "";
    } else {
      return this.raw?.message || "";
    }
  }

  private static anyToError(source: any): [Error, boolean] {
    if (source instanceof Error) {
      return [source, false];
    } else if (
      typeof source === "string" ||
      typeof source === "number" ||
      typeof source === "symbol"
    ) {
      return [new Error(String(source)), false];
    } else if (source instanceof EqErrorRaw) {
      return [new Error(source.toString()), true];
    } else {
      return [new Error("Unknown error"), false];
    }
  }
}

type EqError = typeof EqErrorRaw & {
  new (props: {
    raw?: any;
    label?: string;
    message: string;
    id?: number | string | symbol;
  }): EqErrorRaw;
};

export function createEqError(dev: boolean): EqError {
  return class extends EqErrorRaw {
    constructor(props: {
      raw?: any;
      label?: string;
      message: string;
      id?: number | string | symbol;
    }) {
      super(props, dev);
    }
  };
}
