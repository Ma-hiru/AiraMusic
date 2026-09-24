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

  public take_front() {
    return this.prev?.take();
  }

  public insert(other: Optional<DLinkedNode<K, V>>) {
    if (other) {
      other.append(this.next);
      this.append(other);
    }
    return this;
  }
}

export abstract class LRUCacheBase<K, V> {
  readonly capacity;
  protected readonly cache;
  protected readonly head;
  protected readonly tail;
  private on_drop_callback: Optional<AnyFunc<[K, V]>>;

  protected constructor(capacity?: number, on_drop?: AnyFunc<[K, V]>) {
    if (typeof capacity !== "number" || !Number.isSafeInteger(capacity) || capacity < 0)
      capacity = -1;
    this.capacity = capacity;
    this.cache = new Map<K, DLinkedNode<K, V>>();
    this.head = new DLinkedNode<K, V>(null as K, null as V);
    this.tail = new DLinkedNode<K, V>(null as K, null as V);
    this.head.append(this.tail);
    this._on_drop(on_drop);
  }

  public get size() {
    return this.cache.size;
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
    this.head.insert(node.take());
    this.cache.set(node.key, node);

    if (this.capacity !== -1 && this.size > this.capacity) {
      const node = this.tail.take_front();
      node && this._delete(node.key);
    }

    return node.value as T extends Falsy ? undefined : V;
  }

  protected _get(key: K): Undefinable<V> {
    return this.visit(this.cache.get(key));
  }

  protected _set(key: K, value: V) {
    const node = this.cache.get(key) ?? new DLinkedNode(key, value);
    node.value = value;
    return this.visit(node);
  }

  protected _delete(key: K) {
    const node = this.cache.get(key)?.take();
    node && this.cache.delete(key);
    node && this.on_drop_callback?.(node.key, node.value);
    return node;
  }

  protected _on_drop(callback: Optional<AnyFunc<[K, V]>>) {
    this.on_drop_callback = async (k, v) => {
      try {
        await callback?.(k, v);
      } catch (err) {
        console.error(err);
      }
    };
  }

  public abstract get(key: K): Undefinable<any>;

  public abstract set(key: K, value: any): this;

  public abstract delete(key: K): any;

  public abstract on_drop(callback: Optional<AnyFunc<[K, any]>>): any;
}

export class LRUCache<K, V> extends LRUCacheBase<K, { value: V; expired: number }> {
  readonly time_limit;

  constructor(props: {
    capacity?: number;
    time_limit?: number;
    on_drop?: AnyFunc<[key: K, value: V]>;
  }) {
    const { on_drop, capacity, time_limit } = props;
    super(capacity, (k, v) => on_drop?.(k, v.value));

    if (typeof time_limit !== "number" || !Number.isSafeInteger(time_limit) || time_limit <= 0) {
      this.time_limit = -1;
    } else {
      this.time_limit = time_limit;
    }
  }

  public override on_drop(callback: Optional<AnyFunc<[key: K, value: V]>>) {
    super._on_drop((key, value) => callback?.(key, value.value));
  }

  public override get(key: K): Undefinable<V> {
    const node = super._get(key);
    const now = Date.now();
    if (!node || this.time_limit === -1 || node.expired > now) return node?.value;
    this.delete(key);
  }

  public override set(key: K, value: V) {
    super._set(key, { expired: Date.now() + this.time_limit, value });
    return this;
  }

  public override delete(key: K): Undefinable<V> {
    return super._delete(key)?.value.value;
  }
}
