export default class LRUMap<K, V> {
  private map;
  capacity;

  constructor(capacity: number) {
    this.map = new Map<K, { time: number; value: V }>();
    this.capacity = capacity;
  }

  get(k: K): Undefinable<V> {
    return this.map.get(k)?.value;
  }

  has(k: K) {
    return this.map.has(k);
  }

  set(k: K, v: V) {
    this.map.set(k, { time: Date.now(), value: v });
    requestIdleCallback(() => {
      this.limitSize();
    });
  }

  remove(k: K) {
    this.map.delete(k);
  }

  get size() {
    return this.map.size;
  }

  private limitSize() {
    const collection = [...this.map.entries()].sort((a, b) => a[1].time - b[1].time);
    collection.splice(0, collection.length - this.capacity);
    this.map = new Map(collection);
  }
}
