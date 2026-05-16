export default abstract class Eq<T extends object> {
  eq(other: T) {
    for (const [key, value] of Object.entries(this)) {
      if (typeof value !== typeof other[key as keyof T]) return false;
      if (this.isBaseType(value) && String(other[key as keyof T]) !== String(value)) return false;
      if (Array.isArray(value)) {
        if (!Array.isArray(other[key as keyof T])) return false;
        if ((other[key as keyof T] as Array<unknown>).length !== value.length) return false;
        for (let i = 0; i < value.length; i++) {
          if (value[i] !== (other[key as keyof T] as Array<unknown>)[i]) return false;
        }
      }
    }
    return true;
  }

  private isBaseType(
    value: any
  ): value is number | string | null | undefined | bigint | boolean | symbol {
    return (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      typeof value === "undefined" ||
      typeof value === "bigint" ||
      typeof value === "symbol" ||
      value === null
    );
  }
}
