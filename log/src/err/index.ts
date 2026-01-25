import { AnyToString } from "../string";

export class EqErrorRaw {
  readonly raw?: Error;
  readonly label?: string;
  readonly id?: number | string | symbol;
  readonly message: string;
  readonly dev;

  constructor(
    props: { raw?: any; label?: string; message: string; id?: number | string | symbol },
    dev: boolean = false
  ) {
    const { raw, label, message, id } = props;
    this.dev = dev;
    this.raw = EqErrorRaw.anyToError(raw);
    this.label = label;
    this.message = message;
    this.id = id;
  }

  eq(other: unknown, loose = true): other is this {
    if (!EqErrorRaw.isEqError(other)) return false;
    if (loose) return this.message === other.message;
    return (
      this.getRawMessage() === other.getRawMessage() &&
      this.message === other.message &&
      this.id === other.id
    );
  }

  create(label?: string, err?: any) {
    return new EqErrorRaw(
      {
        label,
        raw: err,
        message: this.message
      },
      this.dev
    );
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

  getRawMessage() {
    if (EqErrorRaw.isEqError(this.raw)) {
      return "\n  " + this.raw.message || "";
    } else {
      return this.raw?.message || "";
    }
  }

  static anyToError(source: any) {
    if (source instanceof Error) {
      return source;
    } else if (source === null || source === undefined) {
      return undefined;
    } else {
      return new Error(AnyToString(source));
    }
  }

  static isEqError(err: unknown): err is EqErrorRaw {
    if (!err) return false;
    return err instanceof EqErrorRaw;
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
