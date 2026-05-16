export class DLinkedNode<K, V> {
  readonly key: K;
  value: V;
  prev: Nullable<DLinkedNode<K, V>>;
  next: Nullable<DLinkedNode<K, V>>;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }

  public append(other: Optional<DLinkedNode<K, V>>) {
    if (other) {
      this.next = other;
      other.prev = this;
    }
    return this;
  }

  public take() {
    this.prev && (this.prev.next = this.next);
    this.next && (this.next.prev = this.prev);
    this.prev = null;
    this.next = null;
    return this;
  }
}

export abstract class LRUCache<K, V> {
  readonly capacity;
  protected _size;
  protected readonly cache;
  protected readonly head;
  protected readonly tail;

  protected constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map<K, DLinkedNode<K, V>>();
    this.head = new DLinkedNode<K, V>(null as K, null as V);
    this.tail = new DLinkedNode<K, V>(null as K, null as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this._size = 0;
  }

  /**
   * @desc 访问节点或新增节点时，将节点移到链表头部。
   * - 访问时，将节点移到链表头部。
   * - 新增时，将节点插入链表头部，size++。
   * @note
   *  - 是否为新增节点的判断逻辑是：节点是否存在于cache中。
   *  - 如果是新节点但是cache中已有相同key的节点，则将新节点插入链表头部，并替换cache中的节点，size不变。
   * */
  private visit<T extends Optional<DLinkedNode<K, V>>>(node: T): T extends Falsy ? undefined : V {
    // 如果节点不存在，则返回undefined
    if (!node) return undefined as T extends Falsy ? undefined : V;
    // 将节点插入链表头部
    node.take();
    node.append(this.head.next);
    this.head.append(node);
    // 如果节点不存在于cache中，则size++，并检查是否需要限制size
    if (!this.cache.has(node.key)) {
      this._size++;
      this.limit();
    }
    this.cache.set(node.key, node);
    return node.value as T extends Falsy ? undefined : V;
  }

  /**
   * @desc 检查是否超过限制，如果超过限制，则删除链表尾部节点，size--。
   * */
  protected _limitSize() {
    if (this._size > this.capacity) {
      this.cache.delete(this.tail.prev!.take().key);
      this._size--;
    }
  }

  protected _get(key: K): Undefinable<V> {
    return this.visit(this.cache.get(key));
  }

  protected _set(key: K, value: V) {
    const node = this.cache.get(key);
    if (node) {
      node.value = value;
      return this.visit(node);
    } else {
      return this.visit(new DLinkedNode(key, value));
    }
  }

  protected abstract limit(): void;

  public abstract get(key: K): Undefinable<any>;

  public abstract set(key: K, value: any): void;

  public get size() {
    return this._size;
  }

  public delete(key: K) {
    if (this.cache.get(key)?.take()) {
      this.cache.delete(key);
      this._size--;
    }
  }
}

export class LRUCacheWithTime<K, V> extends LRUCache<K, { time: number; value: V }> {
  readonly timelimit;

  constructor(capacity: number, timelimit: number) {
    super(capacity);
    this.timelimit = timelimit;
  }

  protected limit() {
    super._limitSize();

    let current = this.tail.prev;
    while (current && current !== this.head && Date.now() - current.value.time > this.timelimit) {
      const delKey = current.key;
      current = current.prev;
      this.delete(delKey);
    }
  }

  get(key: K): Undefinable<V> {
    return super._get(key)?.value;
  }

  set(key: K, value: V) {
    return super._set(key, { time: Date.now(), value });
  }
}
