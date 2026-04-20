import { EqError } from "@mahiru/log/src/err";

type Task<T> = NormalFunc<[], T | Promise<T>>;

export class Lock {
  private locked = false;
  private queue: NormalFunc[] = [];

  acquire() {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  release() {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  get isLocked() {
    return this.locked;
  }

  /**
   * @desc 尝试运行一个任务，task执行失败或者锁定时抛出错误（除非有默认值）
   * @throws {Lock.AcquireLockError} 如果锁定则抛出此错误
   * @throws {Lock.TaskRuntimeError} 如果任务执行失败且无默认值则抛出此错误
   * @param task 要执行的任务
   * @param defaultValue 任务执行失败时的默认值
   * @param label 任务标签，用于错误提示
   * @returns 任务的返回值或默认值
   * */
  async tryRun<T>(task: Task<T>, defaultValue?: NormalFunc<[], T> | T, label?: string) {
    return new Promise<T>((resolve, reject) => {
      function onError(err: unknown) {
        try {
          if (defaultValue !== undefined) {
            if (typeof defaultValue === "function") {
              const func = defaultValue as NormalFunc<[], T>;
              return resolve(func());
            } else {
              return resolve(defaultValue as T);
            }
          }
        } catch {
          /** empty */
        }
        reject(err);
      }

      if (this.locked) {
        return onError(
          new EqError({
            message: "lock acquire failed",
            label: label || "tryRun-lock"
          })
        );
      } else {
        this.locked = true;
      }

      try {
        const result = task();
        if (result instanceof Promise) {
          result
            .then(resolve)
            .catch((err) =>
              onError(
                new EqError({
                  message: "task execution failed",
                  label: label || "tryRun-task",
                  raw: err
                })
              )
            )
            .finally(() => this.release());
        } else {
          this.release();
          return result;
        }
      } catch (err) {
        this.release();
        onError(
          new EqError({
            message: "task execution failed",
            label: label || "tryRun-task",
            raw: err
          })
        );
      }
    });
  }

  /**
   * @desc 运行一个任务，锁定时一直等待，任务执行失败时抛出错误
   * @param task 要执行的任务
   * @param label 任务标签，用于错误提示
   * @returns 任务的返回值
   * */
  async run<T>(task: Task<T>, label?: string) {
    return new Promise<T>((resolve, reject) => {
      this.acquire()
        .then(task)
        .then(resolve)
        .catch((err) =>
          reject(
            new EqError({
              message: "task execution failed",
              label: label || "run-task",
              raw: err
            })
          )
        )
        .finally(() => this.release());
    });
  }
}

export class OwnershipLock {
  private owner?: symbol;
  private queue: Set<NormalFunc> = new Set();

  /**
   * 尝试成为 owner
   */
  acquire() {
    if (this.owner) return;
    const token = Symbol(`lock-owner-${Date.now()}`);
    this.owner = token;
    return token;
  }

  /**
   * 释放 ownership
   */
  release(token: Optional<symbol>) {
    if (!token || this.owner !== token) return;
    this.owner = undefined;
    for (const cb of this.queue) {
      try {
        cb();
      } catch {
        /** empty */
      }
    }
  }

  /**
   * 是否是 owner
   */
  isOwner(owner: Optional<symbol>) {
    return !!owner && this.owner === owner;
  }

  /**
   * 订阅 ownership 变化
   * */
  subscribeOwnership(cb: NormalFunc) {
    this.queue.add(cb);
  }

  /**
   * 取消订阅 ownership 变化
   * */
  unsubscribeOwnership(cb: NormalFunc) {
    this.queue.delete(cb);
  }

  get ownerString() {
    return this.owner?.toString();
  }
}
