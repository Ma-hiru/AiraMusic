export interface Persistable<T> {
  toJSON(): string;
  fromJSON(json: string): T;
}
