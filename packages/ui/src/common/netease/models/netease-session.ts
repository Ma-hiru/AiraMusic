export class NeteaseSession {
  public readonly id: string;
  public readonly createAt: number;

  constructor(id: string, createAt: number) {
    if (!NeteaseSession.checkId(id)) throw new Error(`Invalid session id: ${id}`);
    this.id = id;
    this.createAt = createAt;
  }

  static checkId(id: string): boolean {
    return !!id.match(/^[0-9A-F]{12}$/);
  }

  static generateId(): string {
    return crypto.randomUUID().toUpperCase().replaceAll(/-/g, "").slice(0, 12);
  }

  static generate(): NeteaseSession {
    return new NeteaseSession(NeteaseSession.generateId(), Date.now());
  }
}
