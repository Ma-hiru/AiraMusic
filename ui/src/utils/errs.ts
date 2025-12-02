import { EqError } from "@mahiru/ui/utils/dev";

export const CacheStoreErr = new (class extends EqError {
  constructor() {
    const message = "cache-store server error, in normal case, it will not happen";
    super({ message });
  }

  create(label: string, err: any) {
    return new EqError({
      label,
      raw: err,
      message: this.message
    });
  }
})();

export const NCMServerErr = new (class extends EqError {
  constructor() {
    const message = "ncm server error, check network or ncm server status";
    super({ message });
  }

  create(label: string, err: any) {
    return new EqError({
      label,
      raw: err,
      message: this.message
    });
  }
})();
