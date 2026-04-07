import { AnyToString } from "../string";

export type EqErrorProps = { id?: PropertyKey; raw?: any; label?: string; message: string };

export class EqError {
  readonly id;
  readonly raw;
  readonly label;
  readonly message;
  readonly [Symbol.toStringTag] = "EqError";

  constructor(props: EqErrorProps | string) {
    if (typeof props === "object") {
      this.id = props.id ?? globalThis.crypto.randomUUID();
      this.label = props.label;
      this.message = props.message;
      this.raw = EqError.anyToError(props.raw);
    } else {
      this.id = globalThis.crypto.randomUUID();
      this.message = props;
    }
  }

  eq(other: unknown, loose = true): other is this {
    if (!EqError.isEqError(other)) return false;
    if (loose) return this.message === other.message;
    return (
      this.rawMessage === other.rawMessage && this.message === other.message && this.id === other.id
    );
  }

  derive(label?: string, err?: any) {
    return new EqError({
      label,
      raw: err,
      message: this.message,
      id: this.id
    });
  }

  get rawMessage() {
    return this.raw?.message ?? "";
  }

  static anyToError(source: any) {
    if (source instanceof Error) return source;
    else if (source === null || source === undefined) return undefined;
    return new Error(AnyToString(source));
  }

  static isEqError(err: unknown): err is EqError {
    return err instanceof EqError;
  }

  static isErrorProps(props: any): props is EqErrorProps {
    if (EqError.isEqError(props)) return true;
    if (typeof props !== "object" || props === null || typeof props.message !== "string")
      return false;

    for (const key of Object.keys(props)) {
      if (key !== "id" && key !== "raw" && key !== "label" && key !== "message") {
        return false;
      }
    }

    return true;
  }

  [Symbol.toPrimitive]() {
    let output = this.message;
    if (this.label) output = `[${this.label}] ${output}`;
    if (this.raw) output = `${output}: ${this.rawMessage}`;
    return output;
  }
}
