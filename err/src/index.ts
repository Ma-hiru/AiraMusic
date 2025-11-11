class EqError {
  raw?: Error;
  label?: string;
  message: string;
  isEqError: boolean;

  constructor(props: { raw?: any; label?: string; message: string }) {
    const { raw, label, message } = props;
    const [err, isEqError] = EqError.anyToError(raw);
    this.raw = err;
    this.isEqError = isEqError;
    this.label = label;
    this.message = message;
  }

  eq(other: EqError, strict: boolean = false) {
    if (strict) {
      return (
        this.raw?.message === other.raw?.message &&
        this.label === other.label &&
        this.message === other.message
      );
    }
    if (this.label && other.label) {
      return this.label === other.label && this.message === other.message;
    } else {
      return this.message === other.message;
    }
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
    } else if (source instanceof EqError) {
      return [new Error(source.toString()), true];
    } else {
      return [new Error("Unknown error"), false];
    }
  }
}

export type EqErrorWithDevInfo = typeof EqError & {
  readonly dev: boolean;
  printDEV(label: string, message: string, raw?: any): void;
  printRELEASE(label: string, message: string, raw?: any): void;
  printErrorDEV(label: string, message: string, raw?: any): void;
  printErrorRELEASE(label: string, message: string, raw?: any): void;
  print(label: string, message: string, raw?: any): void;
  printError(label: string, message: string, raw?: any): void;
};

export function createEqError(dev: boolean): EqErrorWithDevInfo {
  return class EqErrorWithDevInfo extends EqError {
    private static readonly dev: boolean = dev;
    static printDEV(label: string, message: string, raw?: any) {
      EqErrorWithDevInfo.dev && EqErrorWithDevInfo.print(label, message, raw);
    }
    static printRELEASE(label: string, message: string, raw?: any) {
      !EqErrorWithDevInfo.dev && EqErrorWithDevInfo.print(label, message, raw);
    }
    static print(label: string, message: string, raw?: any) {
      console.log(new EqError({ label, message, raw }).toString());
    }
    static printErrorDEV(label: string, message: string, raw?: any) {
      EqErrorWithDevInfo.dev && EqErrorWithDevInfo.printError(label, message, raw);
    }
    static printErrorRELEASE(label: string, message: string, raw?: any) {
      !EqErrorWithDevInfo.dev && EqErrorWithDevInfo.printError(label, message, raw);
    }
    static printError(label: string, message: string, raw?: any) {
      console.error(new EqError({ label, message, raw }).toString());
    }
  } as any;
}
