import { AIError } from "./error";

export abstract class AIResult<T> {
  protected abstract _ok: boolean;

  isOk(): this is AIResultOk<T> {
    return this._ok;
  }

  isErr(): this is AIResultError {
    return !this._ok;
  }

  map<U>(fn: (data: T) => U): AIResult<U> {
    if (this.isOk()) {
      return new AIResultOk<U>(fn(this.data));
    } else if (this.isErr()) {
      return this;
    }
    throw new Error("unreachable");
  }

  mapErr(fn: (err: AIError) => AIError): AIResult<T> {
    if (this.isErr()) {
      return new AIResultError(fn(this.reason));
    } else if (this.isOk()) {
      return this;
    }
    throw new Error("unreachable");
  }

  unwrapOr<U>(defaultValue: U): T | U {
    return this.isOk() ? this.data : defaultValue;
  }

  unwrap(): T {
    if (this.isOk()) {
      return this.data;
    } else if (this.isErr()) {
      throw this.reason;
    }
    throw new Error("unreachable");
  }

  static ok<T>(data: T): AIResultOk<T> {
    return new AIResultOk(data);
  }

  static err(props: AIError | ConstructorParameters<typeof AIError>[0]) {
    if (props instanceof AIError) return new AIResultError(props);
    return new AIResultError(new AIError(props));
  }

  static from<T>(raw: Promise<T>): Promise<AIResult<T>> {
    const { promise, resolve } = Promise.withResolvers<AIResult<T>>();

    raw
      .then((data) => resolve(AIResult.ok(data)))
      .catch((e) => resolve(AIResult.err(AIError.raw(e))));

    return promise;
  }
}

class AIResultOk<T> extends AIResult<T> {
  protected _ok = true;
  readonly data: T;

  constructor(data: T) {
    super();
    this.data = data;
  }

  override toString() {
    return `AIResultOk(${this.data})`;
  }
}

class AIResultError extends AIResult<any> {
  protected _ok = false;
  readonly reason: AIError;

  constructor(reason: AIError) {
    super();
    this.reason = reason;
  }

  override toString() {
    return `AIResultError(${this.reason})`;
  }
}
